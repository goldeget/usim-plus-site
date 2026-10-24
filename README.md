# USIM PLUS

Responsive Korean site for the user supplied USIM+ design, with an operator reviewed application photo flow.

The public form accepts one JPG or PNG screenshot (up to 10 MiB) after consent and Turnstile verification. Do not submit names, phone numbers, identity documents, resident registration numbers, passwords, or authentication codes. Photos are stored in a private R2 bucket; D1 stores only an opaque receipt ID, a hash of the receipt token, image metadata, status, and timestamps. Applicants can check status with their receipt ID and token. The admin queue is available on the Cloudflare Access protected `admin.climekr.com` host.

Pending photos expire 30 days after submission. When an operator approves or rejects an application, the image is copied to a fresh R2 key and expires 30 days after that decision. R2 lifecycle processing can add some deletion delay. D1 receipt/status metadata is purged daily after 60 days from submission or decision, so status lookup ends after that retention period. The site does not automatically decide telecom eligibility or issue payments.

## Deployment

- GitHub repository: `goldeget/usim-plus-site`, production branch: `main`
- Cloudflare Pages project: `usim-plus-site`
- Build command: none; output directory: `public`
- Pages Functions: `functions/`
- Git integration deploys pushes to `main`
- Pages hostname: [usim-plus-site.pages.dev](https://usim-plus-site.pages.dev)
- Public domains: [climekr.com](https://climekr.com) and [www.climekr.com](https://www.climekr.com)
- Admin domain: [admin.climekr.com](https://admin.climekr.com), protected by Cloudflare Access

The public form and status lookup use `/api/applications`, `/api/applications/status`, and `/api/applications/config`. The operator queue is at `https://admin.climekr.com/admin/review.html`. The existing CMS remains at `https://admin.climekr.com/`.

## Cloudflare resources

The production Pages project requires:

- D1 binding `CONTENT_DB` for `usim-plus-content`.
- A private R2 bucket named `usim-plus-applications`, bound as `APPLICATIONS_BUCKET`; do not add a public domain.
- D1 migration `migrations/0002_application_submissions.sql`.
- R2 lifecycle rules deleting the `pending/` and `reviewed/` prefixes after 30 days.
- The `usim-plus-application-retention` Worker from `wrangler-retention.toml`, with its daily Cron Trigger and the same D1 binding, to purge receipt metadata after 60 days.
- Pages variable `TURNSTILE_SITE_KEY`, Pages secret `TURNSTILE_SECRET_KEY`, and existing `ADMIN_EMAIL`.
- A Cloudflare Access application covering every path on `admin.climekr.com`.

See [Cloudflare application review setup](docs/cloudflare-application-review-setup.md) before enabling production submissions.

## Content management

`public/admin/index.html` is routed by `functions/_middleware.js` on the management host. It edits the public title, checklist, and FAQs in D1. The photo review queue is a separate Access protected page. The existing `ADMIN_EMAIL` check remains in the Functions in addition to the Cloudflare Access policy.

`migrations/0001_init.sql` creates the site content table. `migrations/0002_application_submissions.sql` creates the photo review metadata table. Apply pending migrations before production submissions.

## Local development

Node.js 22 or later is required. The tests use Node's built-in runner and do not need a package install:

```bash
npm test
```

Apply both migrations and run the local Pages server with local D1/R2 state:

```bash
export XDG_CONFIG_HOME=/workspace/.tools/usim-plus-site/config
export WRANGLER_LOG_PATH=/workspace/.tools/usim-plus-site/logs
WRANGLER=/workspace/.tools/usim-plus-site/node_modules/.bin/wrangler
"$WRANGLER" d1 migrations apply usim-plus-content --local --persist-to /workspace/.tools/usim-plus-site/state
"$WRANGLER" pages dev public --local --port 8788 --persist-to /workspace/.tools/usim-plus-site/state \
  --binding ADMIN_EMAIL=admin@example.test \
  --binding TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  --binding TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

The Turnstile keys above are public test credentials that work only for local development. Never use them or the example `ADMIN_EMAIL` in the production Pages environment. See the Cloudflare setup guide for production bindings and verification.

## Local files

```text
public/index.html                          public application and status page
public/admin/index.html                    Access protected content editor
public/admin/review.html                   Access protected photo review queue
functions/_middleware.js                   admin host routing and identity checks
functions/api/applications.js              consent, Turnstile, image validation, upload
functions/api/applications/status.js       applicant receipt status lookup
functions/api/admin/applications/           Access protected queue, image, and review APIs
functions/api/content.js                   public content read and admin content write API
migrations/                                 D1 schema migrations
```
