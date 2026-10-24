# USIM PLUS information site

Responsive Korean informational site for checking mobile plan and SIM activation terms through each carrier's official channels. It collects applications, identity documents, screenshots, and applicant data.

## Deployment

- GitHub repository: `goldeget/usim-plus-site`, production branch: `main`
- Cloudflare Pages project: `usim-plus-site`
- Build command: none; output directory: `public`
- Pages Functions: `functions/`
- Git integration automatically deploys pushes to `main`
- Pages hostname: [usim-plus-site.pages.dev](https://usim-plus-site.pages.dev)
- Public domains: [climekr.com](https://climekr.com) and [www.climekr.com](https://www.climekr.com)
- Admin domain: [admin.climekr.com](https://admin.climekr.com), protected by Cloudflare Access

The three web hostnames point to the Pages project. Existing MX and TXT records for email and domain verification remain in place.

## Content management

The editor is stored in `public/admin/index.html` and is routed by `functions/_middleware.js` for the management hostname. It edits public copy (headline, checklist, and FAQs) stored in the Cloudflare D1 binding `CONTENT_DB`.

Cloudflare Access allows the administrator's account on `admin.climekr.com`. A separate path-scoped bypass is configured only for `/.well-known/acme-challenge/*` so Cloudflare can validate the admin hostname's certificate. The Pages production environment has `ADMIN_EMAIL` configured for the same administrator. The Function checks the hostname and Access identity before accepting editor writes.

`migrations/0001_init.sql` creates the content table. Apply the migration to any replacement database before deployment.

## Local files

```text
public/index.html            public information page
public/admin/index.html      Access-protected content editor
functions/_middleware.js     host routing for the management editor
functions/api/content.js     public read and authenticated admin write API
```
