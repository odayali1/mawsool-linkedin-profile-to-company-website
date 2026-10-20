import { Actor, log } from 'apify';
import { createHash } from 'node:crypto';

type Input = {
    urls?: string[];
    urlsCsv?: string;
    fileUrl?: string;
    maxUrls?: number;
    concurrency?: number;
    resumeId?: string;
    freshStart?: boolean;
};

const PROFILE_BASE = (process.env.GUEST_API_BASE_URL || 'https://guest.mawsool.tech').replace(/\/+$/, '');
const PROFILE_KEY = process.env.GUEST_API_KEY?.trim();
const COMPANY_BASE = (process.env.COMPANY_API_BASE_URL || 'https://guest.mawsool.tech').replace(/\/+$/, '');
const COMPANY_KEY = process.env.COMPANY_API_KEY?.trim();
const EVENT = process.env.CHARGE_EVENT || 'profile-company-website';
const HARD_MAX = 50_000;
const DIRECT_ATTEMPTS = 5;
const LOOKUP_TIMEOUT_MS = 45_000;
const SECRET_KEY = /^(api[-_]?key|x-api-key|token|access[-_]?token|refresh[-_]?token|secret|password|authorization|credential|credentials)$/i;

function normalizeProfileUrl(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value) return null;
    try {
        const url = new URL(value.startsWith('http') ? value : `https://${value}`);
        if (!/(^|\.)linkedin\.com$/i.test(url.hostname) || !url.pathname.toLowerCase().includes('/in/')) return null;
        url.protocol = 'https:';
        url.hostname = 'www.linkedin.com';
        url.search = '';
        url.hash = '';
        url.pathname = url.pathname.replace(/\/+$/, '');
        return url.toString();
    } catch {
        return null;
    }
}

function normalizeCompanyUrl(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value) return null;
    try {
        const url = new URL(value.startsWith('http') ? value : `https://${value}`);
        if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
        const match = url.pathname.match(/\/company\/([^/?#]+)/i);
        if (!match) return null;
        url.protocol = 'https:';
        url.hostname = 'www.linkedin.com';
        url.pathname = `/company/${match[1]}`;
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

function parseCsv(text: string): string[] {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const split = (line: string) => line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
    const first = split(lines[0]).map((part) => part.toLowerCase());
    const hasHeader = first.some((part) => ['url', 'linkedinurl', 'linkedin_url', 'profileurl', 'profile_url'].includes(part));
    const urlIndex = hasHeader
        ? Math.max(first.findIndex((part) => ['url', 'linkedinurl', 'linkedin_url', 'profileurl', 'profile_url'].includes(part)), 0)
        : 0;
    return lines.slice(hasHeader ? 1 : 0).map((line) => split(line)[urlIndex] || '');
}

async function collectUrls(input: Input): Promise<string[]> {
    const raw = [...(input.urls || [])];
    if (input.urlsCsv) raw.push(...parseCsv(input.urlsCsv));
    if (input.fileUrl) {
        const response = await fetch(input.fileUrl, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`Could not download input file (HTTP ${response.status}).`);
        raw.push(...parseCsv(await response.text()));
    }
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const value of raw) {
        const url = normalizeProfileUrl(value);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        urls.push(url);
    }
    return urls;
}

function stripSecrets(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripSecrets);
    if (!value || typeof value !== 'object') return value;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (SECRET_KEY.test(key)) continue;
        output[key] = stripSecrets(child);
    }
    return output;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanError(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : fallback;
    return message.replace(/https?:\/\/\S+/gi, 'the lookup service');
}

function permanentStatus(status: number): boolean {
    return status === 400 || status === 401 || status === 402 || status === 404 || status === 409 || status === 422;
}

function stalled(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return error.name === 'TimeoutError' || error.name === 'AbortError' || message.includes('fetch failed') || message.includes('network') || message.includes('timed out');
}

function backoff(attempt: number): number {
    return Math.min(8000, 1000 * (2 ** attempt));
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asList(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value !== 'string') return null;
    const trimmed = value.replace(/\s+/g, ' ').trim();
    return trimmed || null;
}

function dateText(value: unknown): string | null {
    const direct = text(value);
    if (direct) return direct;
    const record = asRecord(value);
    if (!record) return null;
    const nested = asRecord(record.start) || record;
    return text(nested.year) || text(nested.month);
}

async function postLookup(base: string, path: string, apiKey: string, url: string, label: string): Promise<Record<string, unknown>> {
    let lastError = `${label} lookup failed`;
    for (let attempt = 0; attempt < DIRECT_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(`${base}${path}`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mawsool-Apify-Profile-Company-Website/1.0',
                    'x-api-key': apiKey,
                },
                body: JSON.stringify({ url }),
                signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
            });
            const raw = await response.text();
            let body: Record<string, unknown> | null = null;
            try { body = JSON.parse(raw) as Record<string, unknown>; } catch { /* handled below */ }
            if (response.ok && body) return stripSecrets(body) as Record<string, unknown>;
            lastError = body && typeof body.error === 'string' ? body.error : `${label} lookup failed with HTTP ${response.status}`;
            if (permanentStatus(response.status)) break;
            log.warning(`${label} lookup attempt ${attempt + 1} of ${DIRECT_ATTEMPTS} did not succeed. Retrying.`);
        } catch (error) {
            lastError = stalled(error) ? `The ${label.toLowerCase()} lookup did not answer in time.` : cleanError(error, 'Network request failed');
            log.warning(`${label} lookup attempt ${attempt + 1} of ${DIRECT_ATTEMPTS} did not succeed. Retrying.`);
        }
        if (attempt < DIRECT_ATTEMPTS - 1) await sleep(backoff(attempt));
    }
    throw new Error(lastError.replace(/https?:\/\/\S+/gi, 'the lookup service'));
}

function slugHash(url: string): string {
    return createHash('sha256').update(url).digest('hex');
}

function currentEmployer(profile: Record<string, unknown>): { companyName: string | null; companyUrl: string | null } {
    const current = asRecord(profile.current_company);
    const currentUrl = normalizeCompanyUrl(current?.link);
    if (currentUrl || text(current?.name)) {
        return {
            companyName: text(current?.name) || text(profile.current_company_name),
            companyUrl: currentUrl,
        };
    }
    for (const item of asList(profile.experience)) {
        const row = asRecord(item) || {};
        if (dateText(row.end_date)) continue;
        const companyUrl = normalizeCompanyUrl(row.url);
        if (companyUrl || text(row.company)) {
            return { companyName: text(row.company), companyUrl };
        }
    }
    return { companyName: text(profile.current_company_name), companyUrl: null };
}

function resultRow(
    profile: Record<string, unknown>,
    inputUrl: string,
    employer: { companyName: string | null; companyUrl: string | null },
    company: Record<string, unknown> | null,
): Record<string, unknown> {
    return {
        inputUrl,
        profileUrl: text(profile.url) || inputUrl,
        fullName: text(profile.name),
        headline: text(profile.position),
        companyName: text(company?.name) || employer.companyName,
        companyUrl: employer.companyUrl,
        website: text(company?.website),
        industry: text(company?.industry),
        success: true,
        checkedAt: new Date().toISOString(),
    };
}

await Actor.init();
if (!PROFILE_KEY) throw new Error('GUEST_API_KEY is not configured as an Apify secret.');
if (!COMPANY_KEY) throw new Error('COMPANY_API_KEY is not configured as an Apify secret.');

const input = (await Actor.getInput<Input>()) || {};
const maxUrls = Math.min(Math.max(Number(input.maxUrls ?? 100), 1), HARD_MAX);
const urls = (await collectUrls(input)).slice(0, maxUrls);
if (!urls.length) throw new Error('No valid LinkedIn profile URLs found. Add URLs, paste CSV, or upload a CSV file.');

const concurrency = Math.min(Math.max(Number(input.concurrency ?? 10), 1), 40);
const progressId = (input.resumeId || 'auto').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60) || 'auto';
const saveProgress = urls.length > 20 || !!input.resumeId;
const skipFinished = saveProgress && !input.freshStart && (urls.length > 200 || !!input.resumeId);
const resumeStore = saveProgress
    ? await Actor.openKeyValueStore(input.resumeId ? `mawsool-profile-website-resume-${progressId}` : 'mawsool-profile-website-progress-auto')
    : null;

log.info(`Starting ${urls.length} profile-to-website lookup(s), concurrency=${concurrency}`);
if (skipFinished) log.info('Finished profiles from an earlier run of this list are skipped. Set freshStart to look them up again.');

let batch = urls;
let deferFailures = urls.length > 1;
let nextIndex = 0;
const deferred: string[] = [];
let processed = 0;
let succeeded = 0;
let failed = 0;
let skipped = 0;
let outputRows = 0;
let stop = false;
let consecutiveOutages = 0;

function noteOutcome(message: string | null): void {
    if (!message) {
        consecutiveOutages = 0;
        return;
    }
    const textValue = message.toLowerCase();
    const outage = textValue.includes('did not answer') || textValue.includes('timed out') || textValue.includes('fetch failed') || textValue.includes('network') || textValue.includes('unavailable') || textValue.includes('unexpected response') || textValue.includes('403') || textValue.includes('429') || textValue.includes('502') || textValue.includes('503') || textValue.includes('504');
    if (!outage) {
        consecutiveOutages = 0;
        return;
    }
    consecutiveOutages += 1;
    if (consecutiveOutages >= 15 && !stop) {
        stop = true;
        log.error('The lookup service looks unavailable. Stopping so finished rows stay saved and the next run can continue.');
    }
}

async function worker(): Promise<void> {
    while (!stop) {
        const index = nextIndex++;
        if (index >= batch.length) return;
        const url = batch[index];
        const recordKey = slugHash(url);
        if (skipFinished && resumeStore && await resumeStore.getValue(`done-${recordKey}`)) {
            skipped += 1;
            continue;
        }
        try {
            const profile = await postLookup(PROFILE_BASE, '/api/v1/full', PROFILE_KEY!, url, 'Profile');
            const employer = currentEmployer(profile);
            const company = employer.companyUrl
                ? await postLookup(COMPANY_BASE, '/api/v1/company-lockup', COMPANY_KEY!, employer.companyUrl, 'Company')
                : null;
            const row = resultRow(profile, url, employer, company);
            const first = await Actor.pushData(row, EVENT);
            if (first?.eventChargeLimitReached) {
                stop = true;
                return;
            }
            outputRows += 1;
            if (resumeStore) await resumeStore.setValue(`done-${recordKey}`, { at: new Date().toISOString() });
            noteOutcome(null);
            processed += 1;
            succeeded += 1;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected lookup error';
            noteOutcome(message);
            if (deferFailures && !stop) {
                deferred.push(url);
                log.warning(`Lookup failed and will be retried at the end: ${message}`);
                continue;
            }
            const charge = await Actor.pushData({
                inputUrl: url,
                success: false,
                website: null,
                error: message,
                checkedAt: new Date().toISOString(),
            }, EVENT);
            if (charge?.eventChargeLimitReached) stop = true;
            processed += 1;
            failed += 1;
            outputRows += 1;
            log.warning(`Failed lookup: ${message}`);
        }
    }
}

async function runBatch(): Promise<void> {
    nextIndex = 0;
    const workers = Math.min(concurrency, batch.length);
    if (workers > 0) await Promise.all(Array.from({ length: workers }, () => worker()));
}

await runBatch();
if (deferred.length && !stop) {
    log.info(`Retrying ${deferred.length} lookup(s) that failed on the first pass.`);
    await sleep(3000);
    batch = deferred.splice(0, deferred.length);
    deferFailures = false;
    await runBatch();
}

await Actor.setValue('OUTPUT', {
    requested: urls.length,
    processed,
    succeeded,
    failed,
    skipped,
    outputRows,
    stoppedByChargeLimit: stop,
});
log.info(`Finished. Processed=${processed}, succeeded=${succeeded}, failed=${failed}, skipped=${skipped}, rows=${outputRows}`);
await Actor.exit();
