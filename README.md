# USIM PLUS information site

Responsive Korean informational site for checking mobile plan and SIM activation terms through each carrier's official channels. It does not accept applications, identity documents, screenshots, or user data.

## Deployment

- Cloudflare Pages project: `usim-plus-site`
- GitHub repository: `goldeget/usim-plus-site` (`main` branch)
- Production host: `climekr.com`
- Pages build output directory: `public`
- Pages Functions: `functions/`

The intended deployment is Cloudflare Pages Git integration on `main`. That connection has not completed yet: Cloudflare returned an error for its Pages Git installation, so the Pages project and custom domain are not live. Reconnect or reinstall the GitHub integration in Cloudflare Pages, then link this repository and enable production deployments for `main`.

The intended public hostname is `climekr.com`; the intended editor hostname is `admin.climekr.com`. Existing Vercel DNS records are left in place until the Pages project is live and admin protection is ready. Do not attach the admin hostname until Cloudflare Zero Trust Access is enabled and an allow policy has been added for the administrator.

## Content management

The editor is stored under `public/admin/index.html` and is served only from `admin.climekr.com` by `functions/_middleware.js`. The intended management hostname must be protected by Cloudflare Access with an allow policy for the administrator. The editor saves only public copy (headline, checklist, and FAQs) to D1. It has no applicant records, image intake, identity-document fields, or payment/reward workflow.

Before using the editor, enable Cloudflare Zero Trust Access, create an allow policy for the administrator's exact email, attach `admin.climekr.com` to the Pages project, and set the Pages environment variable `ADMIN_EMAIL` to that same email. Access is not enabled on the connected account yet. The Pages Function rejects writes from other hostnames and requires matching Cloudflare Access identity and JWT headers.

`migrations/0001_init.sql` creates the content table. The existing Cloudflare D1 database was initialized with this schema and the default public content; apply the migration to any replacement database before deployment.

## Local files

```text
public/index.html            public information page
public/admin/index.html      Access-protected content editor
functions/_middleware.js     host routing for the management editor
functions/api/content.js     public read and authenticated admin write API
```
