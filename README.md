# USIM PLUS information site

Responsive Korean informational site for checking mobile plan and SIM activation terms through each carrier's official channels. It does not collect applications, identity documents, screenshots, or applicant data.

## Deployment

- GitHub repository: `goldeget/usim-plus-site`, production branch: `main`
- Cloudflare Pages project: `usim-plus-site`
- Build command: none; output directory: `public`
- Pages Functions: `functions/`
- Git integration automatically deploys pushes to `main`
- Current Pages hostname: [usim-plus-site.pages.dev](https://usim-plus-site.pages.dev)

The custom hostnames `climekr.com` and `admin.climekr.com` have not yet been attached to this Pages project. Existing Vercel DNS records are being preserved until the Pages deployment and Access protection are ready to serve those hosts.

## Content management

The editor is stored in `public/admin/index.html` and is routed by `functions/_middleware.js` for the management hostname. It edits public copy (headline, checklist, and FAQs) stored in the Cloudflare D1 binding `CONTENT_DB`.

Cloudflare Access has an allow policy for the administrator's account on `admin.climekr.com`. The Pages production environment also has `ADMIN_EMAIL` configured for that account. Attach the custom hostname and update its DNS after the production deployment includes that setting. The Function checks the hostname and Cloudflare Access identity before accepting editor writes.

`migrations/0001_init.sql` creates the content table. Apply the migration to any replacement database before deployment.

## Local files

```text
public/index.html            public information page
public/admin/index.html      Access-protected content editor
functions/_middleware.js     host routing for the management editor
functions/api/content.js     public read and authenticated admin write API
```
