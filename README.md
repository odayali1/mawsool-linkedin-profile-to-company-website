# LinkedIn Profile to Employer Company Website

**Turn one LinkedIn profile URL into the current employer website. $1.50 per 1,000 profiles.** Starting from $0.70 per 1,000
## If you need a different Mawsool Actor

| If this is what you need | Open |
| --- | --- |
| You have an email and want the LinkedIn profile. | [Reverse Email Lookup](https://apify.com/oday/mawsool-email-linkedin-lookup) |
| You have a name and company and want the profile URL. | [LinkedIn Profile Finder](https://apify.com/oday/mawsool-linkedin-profile-finder) |
| You have a profile URL and want the personal email. | [LinkedIn Email Finder](https://apify.com/oday/mawsool-linkedin-personal-email-finder) |
| You only need the current employer, before paying for a full profile. | [Current Company Checker](https://apify.com/oday/mawsool-linkedin-company-checker) |
| You want the current company and headline, and you will compare them to your CRM yourself. | [Profile Freshness Check](https://apify.com/oday/mawsool-linkedin-profile-freshness) |
| You want an alert when the employer or headline changes. | [Job Change Tracker](https://apify.com/oday/mawsool-linkedin-job-change-watch) |
| You have a profile URL and want the full profile. | [LinkedIn Profile Scraper](https://apify.com/oday/mawsool-linkedin-profile-details) |
| You have a large file of profile URLs. | [Mass Profile Scraper](https://apify.com/oday/mawsool-mass-linkedin-profile-scraper) |
| You want the job history only. | [Work Experience](https://apify.com/oday/mawsool-linkedin-profile-experience) |
| You want schools and degrees only. | [Education](https://apify.com/oday/mawsool-linkedin-profile-education) |
| You want a yes or no for one certificate. | [Certification Checker](https://apify.com/oday/mawsool-linkedin-certification-checker) |
| You want certificates, patents, courses, and publications. | [Certifications and Patents](https://apify.com/oday/mawsool-linkedin-profile-credentials) |
| You want likes and comments for outreach. | [Profile Activity](https://apify.com/oday/mawsool-linkedin-profile-activity) |
| You have a company URL and want the full company record. | [Company Details](https://apify.com/oday/mawsool-linkedin-company-details) |
| You have a large file of company URLs. | [Mass Company Scraper](https://apify.com/oday/mawsool-mass-linkedin-company-scraper) |
| You want the website, industry, and employee range. | [Firmographics and Website](https://apify.com/oday/mawsool-linkedin-company-firmographics) |
| You want office addresses. | [Company Locations](https://apify.com/oday/mawsool-linkedin-company-locations) |
| You want lookalike companies. | [Similar Companies](https://apify.com/oday/mawsool-linkedin-similar-companies) |
| You want the recent posts on a company page. | [Company Posts](https://apify.com/oday/mawsool-linkedin-company-posts) |
| You want only new posts on the next scheduled run. | [Company Post Monitor](https://apify.com/oday/mawsool-linkedin-company-post-watch) |

The same list is on [Mawsool's Apify profile](https://apify.com/oday).

## Use with AI agents

Apify exposes this Actor to ChatGPT, Claude, Gemini, Grok, and other agents through the Apify MCP server. Tell the agent the input you have, the fields you want back, and the starting price on this page. If you already have profile URLs and only need the current company and headline, use [Profile Freshness Check](https://apify.com/oday/mawsool-linkedin-profile-freshness) first and compare the result to your CRM yourself.

 A visitor who starts on one Actor can open the rest from that page.


Outbound teams already have the profile URL. This Actor returns the company site for the sequence. One profile is one row and one charge. The price stays under [Profile Details](https://apify.com/oday/mawsool-linkedin-profile-details) at $1.80 per 1,000.

## Who is this for?

SDRs and agencies loading a sequence. You have `linkedin.com/in/...` and you need the employer domain, not the full profile.

## How to run it

```json
{
  "urls": ["https://www.linkedin.com/in/example"]
}
```

Paste a CSV with a `url` column, or upload a CSV file. Lists over 200 continue if the run stops. Set `resumeId` to skip profiles that already succeeded.

## What does a row look like?

```json
{
  "inputUrl": "https://www.linkedin.com/in/example",
  "fullName": "Example Person",
  "headline": "Account Executive",
  "companyName": "Example",
  "companyUrl": "https://www.linkedin.com/company/example",
  "website": "https://example.com",
  "industry": "Software Development",
  "success": true
}
```

## FAQ

### Why is this $1.50 and not $1.00?

Each profile needs two lookups: the profile, then the employer page. [Profile Details](https://apify.com/oday/mawsool-linkedin-profile-details) is $1.80 and does not return the website. Running [Profile Details](https://apify.com/oday/mawsool-linkedin-profile-details) and Company Website together is $2.80. This Actor does both steps for $1.50.

### What if the profile has no current company?

You still get one row. `website` is empty and you are charged once. An empty website is a result, not a failed run.

### When should I use the other Actors?

Use [Profile Details](https://apify.com/oday/mawsool-linkedin-profile-details) at $1.80 when you need the job history, about, and activity. Use Company Website and Firmographics at $1.00 when you already have the company URL and want headcount, headquarters, and specialties.

### Does a long list keep going?

Yes. Up to 50,000 URLs. Ten profiles run at a time, and you can raise that to 40. A list over 200 resumes on the next run. After 15 lookup outages in a row the run stops so finished rows stay saved.

## Paid plans

| Plan | This Actor | [Profile Details](https://apify.com/oday/mawsool-linkedin-profile-details) |
| --- | --- | --- |
| Free | $1.50 / 1,000 | $1.80 / 1,000 |
| Bronze | $1.40 | $1.65 |
| Silver | $1.20 | $1.50 |
| Gold | $1.00 | $1.20 |
| Platinum | $0.85 | $1.00 |
| Diamond | $0.70 | $0.80 |

## Related Actors

Company Website and Firmographics when you start from a company URL. [Profile Details](https://apify.com/oday/mawsool-linkedin-profile-details) for the full profile. [Current Company Checker](https://apify.com/oday/mawsool-linkedin-company-checker) when you only need to know if the employer changed.
