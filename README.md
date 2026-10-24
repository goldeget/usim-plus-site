# USIM PLUS information site

Responsive Korean informational site for checking mobile plan and SIM activation terms through each carrier's official channels. It does not accept applications, identity documents, screenshots, or user data.

## Deployment

- Cloudflare Pages project: `usim-plus-site`
- GitHub repository: `goldeget/usim-plus-site` (`main` branch)
- Production host: `info.climekr.com`
- Pages build output directory: `public`
- Pages Functions: `functions/`

Cloudflare Pages Git integration should deploy each push to `main` automatically. The main domain and existing `admin.climekr.com` are intentionally left with their current Vercel DNS records.

## Content management

The editor is stored under `public/admin/index.html` and is served only from `manage.climekr.com` by `functions/_middleware.js`. The intended management hostname must be protected by Cloudflare Access with an allow policy for the administrator. The editor saves only public copy (headline, checklist, and FAQs) to D1. It has no applicant records, image intake, identity-document fields, or payment/reward workflow.

Before using the editor, configure Cloudflare Zero Trust Access for `manage.climekr.com` and attach the `CONTENT_DB` D1 binding. The Pages Function also rejects writes from other hostnames and requires the Cloudflare Access identity header.

## Local files

```text
public/index.html            public information page
public/admin/index.html      Access-protected content editor
functions/_middleware.js     host routing for the management editor
functions/api/content.js     public read and authenticated admin write API
```
