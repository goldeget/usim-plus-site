# USIM PLUS Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, responsive admin console with clear operations navigation, application history, duplicate-review signals, and the existing content editor.

**Architecture:** Keep static Pages HTML and JavaScript with existing authenticated Pages Functions and D1/R2. Add keyed IP and exact-photo hashes to submission metadata, protected summary/duplicate APIs, and a shared responsive navigation shell.

**Tech Stack:** Cloudflare Pages Functions, D1, R2, static HTML/CSS/JS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-24-admin-console-design.md`

## Global Constraints

- Raw source IP must not be persisted or exposed. Use HMAC-SHA-256 with `ADMIN_AUTH_SECRET` and domain separation.
- Duplicate indicators are review signals only; never automate a decision from IP or image similarity.
- Retain comparison hashes only with application metadata and existing 60-day cleanup.
- Keep admin pages/API behind the existing HTTPS `admin.climekr.com` session and private no-store responses.
- Keep original photos in private R2 and serve only through the authenticated image function.
- Add no runtime dependencies.

## Review Focus

- Missing `cf-connecting-ip` must not create one shared false duplicate group; pin to the submission helper/API tests.
- Multiple applicants behind one NAT must remain independently reviewable; duplicate API/UI tests must assert signal-only wording and no automatic decision.
- Existing legacy rows without fingerprints must remain listable and reviewable; pin to admin API tests.
- A status filter or cursor must not leak raw hashes or R2 keys; pin to application listing API tests.
- Mobile menu, logout, and long form controls must remain reachable at narrow widths; pin to static accessibility/markup checks and inspect generated CSS behavior.

---

### Task 1: Capture duplicate-review signals safely

**Files:**
- Create: `migrations/0004_application_review_signals.sql`
- Modify: `functions/_lib/applications.js`
- Modify: `functions/api/applications.js`
- Modify: `test-support/cloudflare.js`
- Modify: `test/application-submission.test.js`

**Interfaces:**
- Add nullable `source_ip_hash` and `image_hash` columns; index both with creation time.
- Export `hmacSubmissionSignal(secret, purpose, value)` and `sha256Image(bytes)` from the application helper.

- [ ] Add coverage for same-source HMAC stability/domain separation, exact image hash, absent IP, and values persisted on successful submission.
- [ ] Run the focused application submission tests and confirm the new cases fail before implementation.
- [ ] Add migration and persist only the keyed IP fingerprint and image digest alongside the existing D1 row.
- [ ] Run focused submission tests and the full suite.

### Task 2: Add protected operations and duplicate APIs

**Files:**
- Create: `functions/api/admin/dashboard.js`
- Create: `functions/api/admin/applications/duplicates.js`
- Modify: `functions/api/admin/applications.js`
- Modify: `test-support/cloudflare.js`
- Modify: `test/application-admin.test.js`

**Interfaces:**
- `GET /api/admin/dashboard` returns pending/recent decisions/duplicate-group summary only.
- `GET /api/admin/applications?status=pending|approved|rejected|all&cursor=...` returns stable pages without private object keys or signal hashes.
- `GET /api/admin/applications/duplicates` returns grouped application IDs and metadata with signal labels, never the HMAC/image digest.

- [ ] Add tests for auth, filters, legacy records, duplicate grouping, and raw-value secrecy.
- [ ] Run focused admin tests and confirm new cases fail before implementation.
- [ ] Implement the three protected APIs with bounded results, stable pagination, and no-store responses.
- [ ] Run focused admin tests and the full suite.

### Task 3: Create the responsive operator console

**Files:**
- Create: `public/admin/admin-shell.css`
- Create: `public/admin/admin-shell.js`
- Create: `public/admin/applications.html`
- Create: `public/admin/duplicates.html`
- Modify: `public/admin/index.html`
- Move/modify: `public/admin/content.html` (preserve existing editor)
- Modify: `public/admin/review.html`
- Modify: `functions/_middleware.js`
- Modify: `test/admin-middleware.test.js`
- Modify: `test/application-admin.test.js`

- [ ] Add markup/accessibility checks for navigation hierarchy, mobile menu controls, page links, duplicate explanations, and editor access.
- [ ] Run the focused static page/middleware tests and confirm newly added assertions fail.
- [ ] Build a shared light admin shell with desktop navigation, mobile drawer, active states, breadcrumbs, secure session/logout actions, and responsive touch targets.
- [ ] Replace the landing page with a dashboard, preserve content editing at `/admin/content.html`, and add filtered application and duplicate-review pages.
- [ ] Keep the existing photo review queue and approval/rejection flow reachable from the shell.
- [ ] Run the full suite and inspect the final diff/build output.

### Task 4: Update privacy disclosures and verify release

**Files:**
- Modify: `public/index.html`
- Modify: `test/public-page.test.js`
- Modify: `README.md`

- [ ] Add assertions that the public privacy notice and consent disclose keyed IP and image-hash duplicate-review signals and the 60-day metadata period.
- [ ] Run public-page tests and confirm the disclosure assertion fails before implementation.
- [ ] Update Korean disclosures, including that raw IP is not stored and a shared IP alone does not prove a duplicate user.
- [ ] Run the full test suite, Pages Functions build, deploy migration, and smoke-check public/admin boundaries and private API authorization.
