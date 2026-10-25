# USIM PLUS

Responsive Korean site for the user supplied USIM+ design, with an operator reviewed application photo flow.

New applications and photo conversations now take place in the LINE, Telegram or ChannelTalk links configured by the operator at `/admin/content.html`. The homepage no longer uploads photos or loads Turnstile; `POST /api/applications` returns 410 for cached forms without reading or storing their bodies. Messenger photos and messages are not synchronized into the admin photo queue. Until at least one real conversation link is registered, the page clearly shows unavailable channels and an email fallback.

The following storage and review details apply only to existing homepage submissions: Do not submit names, phone numbers, identity documents, resident registration numbers, passwords, or authentication codes. Photos are stored in a private R2 bucket. D1 stores an opaque receipt ID, a hash of the receipt token, image metadata and SHA-256 fingerprint, a keyed HMAC of the source IP when Cloudflare supplies it, status, and timestamps. The raw source IP is not stored. Applicants can check status with their receipt ID and token. The admin site uses a single email/password account with D1-backed sessions on `admin.climekr.com`; Pages Functions protect every admin page and API.

Pending photos expire 30 days after submission. When an operator approves or rejects an application, the image is copied to a fresh R2 key and expires 30 days after that decision. R2 lifecycle processing can add some deletion delay. D1 receipt/status metadata is purged daily after 60 days from submission or decision, so status lookup ends after that retention period. The site does not automatically decide telecom eligibility or issue payments.

## Deployment

- GitHub repository: `goldeget/usim-plus-site`, production branch: `main`
- Cloudflare Pages project: `usim-plus-site`
- Build command: none; output directory: `public`
- Pages Functions: `functions/`
- Git integration deploys pushes to `main`
- Pages hostname: [usim-plus-site.pages.dev](https://usim-plus-site.pages.dev)
- Public domains: [climekr.com](https://climekr.com) and [www.climekr.com](https://www.climekr.com)
- Admin domain: [admin.climekr.com](https://admin.climekr.com), protected by the Pages session middleware. The Cloudflare Access app is bypassed only after the session guards are deployed and verified.

Existing receipt holders can still use `/api/applications/status`. The protected legacy photo review, retention cleanup and D1/R2 data remain intact. The operator console opens at `https://admin.climekr.com/`, with dashboard, review queue, application history, duplicate signals, and the content editor at `/admin/content.html`.

## Search and AI discovery

The public page declares `https://climekr.com/` as its canonical URL and provides Korean Open Graph metadata, Schema.org organization/service/FAQ data, host-aware `robots.txt`, `sitemap.xml`, and `llms.txt`. The homepage route renders saved search and social metadata into the original HTML, including the visible FAQ and current payout schedule, so crawlers and link previews receive the same content as visitors. Its edge copy expires after 15 seconds and is cleared when the operator publishes changes. `www.climekr.com` redirects to the canonical host, Pages preview hosts send `noindex`, and the admin hostname blocks crawling. The public sitemap and `llms.txt` remain repository-managed. The hosted IndexNow key file lets participating search engines receive a URL update after deployment.

These settings help crawlers understand the service, but search ranking and AI answers are determined by external providers and cannot be guaranteed. Google Search Console and Naver Search Advisor still require site ownership verification before submitting the sitemap there.

## Free search and social entry points

- `/guide/`: original, indexable Korean explainer for people comparing non-loan SIM activation benefits. Prominently states that CLIME is **not a loan product**, that payment is conditional and not immediate, and that the applicant must check all telecom costs and contract responsibilities before applying. Reads the latest milestone amounts from the existing public `/api/content` endpoint, with no fixed 51/66만원 promise in the HTML.
- `/links/`: lightweight, mobile-first `noindex` link-in-bio page with direct Telegram and ChannelTalk buttons. Uses the two verified operator-configured consultation links, with safe fallbacks.
- The official homepage footer links to both, while the public sitemap lists only the distinct, search-eligible guide. Existing Pages preview hosts remain `noindex`.
- No new domains, third-party accounts, Pages projects, or paid subscriptions are created by these files. They deploy through the **existing** Cloudflare Pages project after a commit lands on `main`.

Deployment, optional free platform usage, and non-loan advertising cautions are documented in [docs/free-entry-points.md](docs/free-entry-points.md).

## Cloudflare resources

The production Pages project requires:

- D1 binding `CONTENT_DB` for `usim-plus-content`.
- A private R2 bucket named `usim-plus-applications`, bound as `APPLICATIONS_BUCKET`; do not add a public domain.
- D1 migrations `migrations/0002_application_submissions.sql`, `migrations/0003_admin_password_auth.sql`, and `migrations/0004_application_review_signals.sql`.
- R2 lifecycle rules deleting the `pending/` and `reviewed/` prefixes after 30 days.
- The `usim-plus-application-retention` Worker from `wrangler-retention.toml`, with its daily Cron Trigger, the same D1 binding, and the private R2 bucket binding, to purge receipt metadata after 60 days and remove unreferenced reviewed-photo copies.
- Pages variable `TURNSTILE_SITE_KEY`, Pages secrets `TURNSTILE_SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_AUTH_SECRET`.
- A Cloudflare Access application for `admin.climekr.com`. Set its policy to Bypass only after the new deployment and route-guard checks pass; the application still requires a password session.

See [Cloudflare application review setup](docs/cloudflare-application-review-setup.md) before enabling production submissions.

## Content management

The session-protected admin console uses a shared responsive navigation shell. `/` is the operations dashboard; `/admin/review.html` is the pending photo queue; `/admin/applications.html` shows application history; `/admin/duplicates.html` groups exact photo matches and keyed source-IP signals; `/admin/content.html` edits public page copy, payout milestones, the eligibility lookup URL, consultation links, legacy status labels, privacy section labels, operator details, footer, SEO/social metadata, and FAQs in D1. All 59 editable public-copy fields have matching editor controls. The factual privacy statements and retention periods are fixed to the actual data handling and cleanup rules; the editor does not allow them to be changed into inaccurate claims. Payout totals and the payout FAQ answer are calculated from the milestone amounts and case limit, and literal payout claims in editable public copy are checked against the current amounts and retention days. Layout, colors, and interaction behavior remain code-managed. Duplicate matches are review clues only and are never automatically approved or rejected. A shared IP can represent different people, and exact image hashes only detect identical files. `ADMIN_EMAIL` selects the single operator; `ADMIN_PASSWORD` is stored as an encrypted Pages secret and is never stored in D1. `ADMIN_AUTH_SECRET` is a separate random secret used to invalidate sessions after credential rotation, key login throttling, and derive non-reversible source-IP comparison values.

`migrations/0001_init.sql` creates the site content table. `migrations/0002_application_submissions.sql` creates the photo review metadata table. `migrations/0003_admin_password_auth.sql` creates hashed admin sessions and login throttle rows. `migrations/0004_application_review_signals.sql` adds keyed IP and image comparison hashes. These comparison values are deleted with application metadata after 60 days. Apply pending migrations before production traffic.

## Local development

Node.js 22 or later is required. The tests use Node's built-in runner and do not need a package install:

```bash
npm test
```

Apply all migrations and run the local Pages server with local D1/R2 state. Put development-only `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and `ADMIN_AUTH_SECRET` (at least 32 random bytes) in the ignored `.dev.vars` file first. Never reuse production secret values or commit `.dev.vars`.

```bash
export XDG_CONFIG_HOME=/workspace/.tools/usim-plus-site/config
export WRANGLER_LOG_PATH=/workspace/.tools/usim-plus-site/logs
WRANGLER=/workspace/.tools/usim-plus-site/node_modules/.bin/wrangler
"$WRANGLER" d1 migrations apply usim-plus-content --local --persist-to /workspace/.tools/usim-plus-site/state
"$WRANGLER" pages dev public --local --port 8788 --persist-to /workspace/.tools/usim-plus-site/state \
  --binding TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  --binding TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

The Turnstile keys above are public test credentials that work only for local development. Never use them or the example `.dev.vars` credentials in the production Pages environment. See the Cloudflare setup guide for production bindings and verification.

## Local files

```text
public/index.html                          public application and status page
public/admin/login.html                    email and password login form
public/admin/index.html                    session-protected operations dashboard
public/admin/review.html                   session-protected photo review queue
public/admin/applications.html             session-protected application history
public/admin/duplicates.html                session-protected duplicate-signal review
public/admin/content.html                   session-protected content editor
functions/_middleware.js                   admin host routing and session checks
functions/api/applications.js              retires new homepage uploads with HTTP 410
functions/api/applications/status.js       applicant receipt status lookup
functions/api/admin/applications/           session-protected queue, image, and review APIs
functions/api/content.js                   public content read and admin content write API
functions/index.js                          live HTML metadata for search and social previews
migrations/                                 D1 schema migrations
```
