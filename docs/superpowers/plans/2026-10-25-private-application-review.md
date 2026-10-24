# Private Application Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the supplied USIM+ landing page while adding real, privacy-minimal photo submission, private 30-day storage, applicant status lookup, and Access-protected operator review.

**Architecture:** Cloudflare Pages Functions validate public submissions, store image bytes only in a private R2 bucket, and keep opaque IDs, status, timestamps, image metadata, and a hashed receipt token in D1. Turnstile protects public uploads; admin APIs independently check Cloudflare Access identity and origin; an admin review page handles one-time decisions.

**Tech Stack:** Cloudflare Pages Functions, D1, private R2, Turnstile, static HTML/CSS/JavaScript, Node.js built-in test runner, Wrangler.

**Spec:** `docs/superpowers/specs/2026-10-24-usim-photo-review-design.md`

## Global Constraints

- Accept JPEG and PNG only, with server-side signature checks and a 10 MiB file limit.
- Never collect applicant name, phone, ID number, authentication code, password, or original filename.
- Keep all R2 reads private; applicant status responses never expose image bytes or object keys.
- Require affirmative consent and successful Turnstile verification before accepting an upload.
- Require `admin.climekr.com`, matching `ADMIN_EMAIL`, a Cloudflare Access assertion, and same-origin checks for decisions.
- Keep unreviewed images for 30 days from submission and reviewed images for 30 days from decision; disclose lifecycle processing delay.
- Keep D1 receipt/status metadata until the 60-day cutoff after submission or decision; a daily Worker removes eligible rows on its scheduled run and status lookup then ends.
- Preserve the attached responsive visual design and keep support-channel cards disabled until actual URLs are supplied.
- Do not infer telecom eligibility or initiate payments from the uploaded image.

## Review Focus

- Forged MIME type or malformed image bytes: validation tests reject before R2 writes.
- Missing consent, invalid Turnstile, and absent bindings: API tests return errors without storing a photo.
- Incorrect or malformed receipt ID/token: status tests return no application details or photo.
- Missing Access identity, wrong email/host/origin, and repeated decisions: admin tests deny access or allow only the first decision.
- Concurrent or failed R2/D1 review operations: review tests preserve the winning database state and avoid leaving the losing object's key active.

---

### Task 1: Application schema and shared validation/security helpers

**Files:**
- Create: `migrations/0002_application_submissions.sql`
- Create: `functions/_lib/applications.js`
- Create: `package.json`
- Create: `test/applications.test.js`

**Interfaces:**
- `validateImage({ contentType, bytes, size })` returns `null` or a Korean validation message.
- `generateReferenceId(cryptoApi)` returns a URL-safe opaque ID; `generateReceiptToken(cryptoApi)` returns a 256-bit URL-safe token.
- `hashReceiptToken(token, cryptoApi)` returns a lowercase SHA-256 hex digest.
- `isAdminRequest(request, env, { requireOrigin })` returns a boolean after exact host, email, Access assertion, and optional origin checks.
- `jsonResponse(data, status)` always adds JSON UTF-8, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`.

- [x] **Step 1: Add failing tests** for JPEG/PNG signatures, MIME mismatch, unsupported formats, zero/oversize images, URL-safe random credentials, token hashing, and each admin identity/origin failure.
- [x] **Step 2: Run `npm test -- --test-name-pattern='image|token|admin'`** and confirm failures are caused by missing helper exports.
- [x] **Step 3: Add the D1 table** with opaque ID, token hash, generated object key, MIME type, byte size, pending/approved/rejected status, created timestamp, and nullable review timestamp; add a queue index.
- [x] **Step 4: Implement only the tested helpers** using Web Crypto APIs supported by Workers.
- [x] **Step 5: Run the focused tests, then `npm test`** and confirm all expected cases pass.

### Task 2: Public submission, receipt, and status APIs

**Files:**
- Create: `functions/api/applications.js`
- Create: `functions/api/applications/status.js`
- Create: `functions/api/applications/config.js`
- Create: `test/application-submission.test.js`

**Interfaces:**
- `POST /api/applications` accepts multipart `statusImage`, `privacyConsent=on`, and `cf-turnstile-response`; success returns `{ id, token, createdAt }` once.
- `POST /api/applications/status` accepts JSON `{ id, token }`; success returns `{ status, createdAt, reviewedAt }` only.
- `GET /api/applications/config` returns the public Turnstile site key only; it never returns the secret.

- [x] **Step 1: Add failing endpoint tests** for a successful private R2/D1 write, missing consent, Turnstile failure, invalid bytes, oversize body/file, absent bindings, correct receipt lookup, incorrect token, and expired status.
- [x] **Step 2: Run `npm test -- test/application-submission.test.js`** and confirm the endpoint behavior is missing.
- [x] **Step 3: Implement Turnstile Siteverify validation** for action `submit` and the public hostnames, without sending applicant IPs or logging tokens/photos.
- [x] **Step 4: Implement the upload flow** with generated `pending/` keys, token hashing, D1 metadata insertion, and compensating R2 deletion if D1 insertion fails.
- [x] **Step 5: Implement status/config responses** with strict input bounds, no-store headers, generic invalid-receipt responses, and expiry after 30 days from submission.
- [x] **Step 6: Run focused tests and `npm test`**; confirm no test response contains bytes, names, source filenames, or R2 keys.

### Task 3: Access-protected review APIs and operator queue

**Files:**
- Create: `functions/api/admin/applications.js`
- Create: `functions/api/admin/applications/image.js`
- Create: `functions/api/admin/applications/review.js`
- Create: `public/admin/review.html`
- Modify: `public/admin/index.html`
- Create: `test/application-admin.test.js`

**Interfaces:**
- `GET /api/admin/applications?cursor=...` returns a paged pending queue with ID, creation time, MIME type, and size.
- `GET /api/admin/applications/image?id=...` returns only the authorized R2 image with `private, no-store`, `nosniff`, and inline disposition.
- `POST /api/admin/applications/review` accepts JSON `{ id, decision }`, where decision is `approved` or `rejected`; one conditional transition wins.

- [x] **Step 1: Add failing tests** for unauthenticated list/image/decision access, wrong host/email/origin, successful authorized image reads, approval/rejection, repeated decisions, and R2-copy or D1-update failures.
- [x] **Step 2: Run `npm test -- test/application-admin.test.js`** and confirm expected failures.
- [x] **Step 3: Implement Access-checked queue and image handlers**; the D1 query excludes records past the pending 30-day window.
- [x] **Step 4: Implement one-time review** by copying to a fresh `reviewed/` key, conditionally updating pending D1 state, then deleting the old key; clean up a losing decision copy when the concurrent winner differs.
- [x] **Step 5: Build an accessible Korean review page** with queue paging, original-image preview, dates/status, confirm-before-decision, loading/error states, and a link from the existing content editor.
- [x] **Step 6: Run focused tests and `npm test`**; verify all admin responses are no-store and unauthorized requests cannot list, read, or change submissions.

### Task 4: Connect the supplied public page and privacy disclosures

**Files:**
- Modify: `public/index.html`
- Create: `test/public-page.test.js`

**Interfaces:**
- Public form submits to `/api/applications`, displays a one-time copyable receipt, and supports status lookup using that receipt.
- Turnstile site key is loaded from `/api/applications/config`; upload stays disabled until the widget is ready.

- [x] **Step 1: Add failing checks** for the required API paths, consent and retention disclosures, responsible-party contact, disabled unset support links, and removal of all mockup-only submission claims.
- [x] **Step 2: Run `npm test -- test/public-page.test.js`** and confirm the current page fails because it still claims no server upload occurs.
- [x] **Step 3: Update only the affected copy, form feedback, and script behavior**, retaining the supplied page's layout and embedded artwork; add accessible receipt and status-result regions.
- [x] **Step 4: Disclose the photo-only purpose, 10 MiB JPG/PNG limit, operator review, 30-day expiry rules, consent refusal, company/controller details, and help@climekr.com.** Keep image instructions warning against unrelated sensitive content.
- [x] **Step 5: Run page checks and `npm test`**; compare the retained layout/assets against the supplied HTML and confirm Telegram, LINE, KakaoTalk, and Channel Talk remain inactive.

### Task 5: Cloudflare bindings, lifecycle, documentation, and validation

**Files:**
- Modify: `wrangler.toml`
- Create: `wrangler-retention.toml`
- Create: `retention-worker.js`
- Modify: `README.md`
- Create: `docs/cloudflare-application-review-setup.md`
- Modify: `public/index.html`
- Modify: `test/cloudflare-config.test.js`
- Create: `test/retention-worker.test.js`

- [x] **Step 1: Add the `APPLICATIONS_BUCKET` R2 binding** to Wrangler for bucket `usim-plus-applications`, leaving the current D1 binding and Pages output intact.
- [x] **Step 2: Add a failing retention test** for a pending row older than 60 days, a reviewed row older than 60 days from its decision, and rows still inside the 30-day post-photo support period; then configure a daily scheduled Worker.
- [x] **Step 3: Document production setup** for the private R2 bucket, Pages binding, 30-day lifecycle rules on `pending/` and `reviewed/`, D1 migration and 60-day metadata purge Worker, Turnstile domains/keys, Access policy, and required Pages variables/secrets.
- [x] **Step 4: Correct README and privacy disclosures** so they describe the actual photo-only flow, both image/metadata retention periods, and do not claim identity documents or applicant data are collected.
- [x] **Step 5: Run `npm test`, `wrangler pages dev public --local --port 8788` with local D1/R2 state, and representative HTTP requests** for static page/config, public rejection, and admin denial. Validate the Worker config with Wrangler dry-run.
- [x] **Step 6: Apply migrations locally twice** and confirm the second run is repeatable; inspect the attachment artwork, `git diff --check`, and `git status` before deployment work.
- [x] **Step 7: Check Cloudflare auth and resource readiness.** Deploy only after R2, Turnstile, Access, D1, and the retention Cron Trigger are ready; otherwise save the exact missing credential/configuration requirements for the user and report that remote deployment remains blocked.
