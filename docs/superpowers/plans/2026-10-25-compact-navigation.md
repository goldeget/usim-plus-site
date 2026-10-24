# Simple User Offer and Admin Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public site’s multi-choice task navigation with one clear offer and primary action, keep optional tasks behind direct links and disclosures, bound admin history length, and defer retryable Turnstile verification until submission.

**Architecture:** Keep the static Pages frontend and existing Functions API. Use one public landing page with hash-compatible disclosures; retain the current form, data, consent, and SEO schema. Use ten-row cursor pages and a narrowly scoped exact-ID query for admin history.

**Tech Stack:** Static HTML/CSS, browser JavaScript, Cloudflare Pages Functions, D1, Node test runner, Chromium/Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-compact-navigation.md`

## Global Constraints

- Preserve the three-step user order and the distinction between photo precheck, carrier approval, and payment eligibility.
- Do not remove managed Turnstile or relax private photo/session protections.
- Keep the selected 30-day photo and 60-day metadata retention rules unchanged.
- Keep private application IDs, HMAC fingerprints, IP values, and R2 keys out of public responses.
- Maintain Korean copy, keyboard access, 44px touch targets, reduced-motion support, and no horizontal overflow from 320px upward.

## Review Focus

- Direct hash navigation must select the expected view even after a refresh; test each supported legacy hash.
- A declined or invalid photo/consent must not execute Turnstile or send an upload; add a test that the loader is deferred.
- A failed Turnstile script/config request must leave an accessible retry path; test a failed first setup then successful retry.
- Page cursor navigation must not skip tied timestamps, duplicate rows, or leak private fields; test at least 21 same-time history rows over three pages.
- Exact receipt lookup must honor the selected retention window and must not make an expired photo reviewable; test retained and expired pending records.

---

### Task 1: Offer-first public landing page

**Files:**
- Modify: `public/index.html`
- Create: `public/user-flow.css`
- Test: `test/public-page.test.js`

**Interfaces:**
- One primary action opens the application disclosure; one secondary link opens status lookup.
- Existing hashes remain usable as deep links to the relevant disclosures.
- CMS still edits the same three-step checklist and visible FAQ schema.

- [ ] Write tests for the one offer, one primary action, one secondary status link, and direct disclosure links.
- [ ] Run `node --test test/public-page.test.js` and confirm the new assertions fail for the four-tab interface.
- [ ] Remove task tabs, feature the reward conditions and single application action, keep the process to one line, and group secondary content behind disclosures.
- [ ] Run the focused tests and verify direct hashes plus CMS content application.

### Task 2: Submission-time Turnstile and retry

**Files:**
- Modify: `public/index.html`
- Test: `test/public-page.test.js`

**Interfaces:**
- Keep the current sitekey/config endpoint and server-side `siteverify` check.
- Turnstile initializes in execute mode only after a valid submit attempt.

- [ ] Add tests proving that opening the application view does not load Turnstile, that invalid forms do not request it, and that retry UI exists.
- [ ] Confirm the new deferred-load assertions fail before the implementation.
- [ ] Trigger Turnstile only from a valid submit attempt; make load errors retryable and preserve existing callback/failure messaging.
- [ ] Test the flow with a controlled Turnstile stub and re-run the public test file.

### Task 3: Bounded admin history and receipt lookup

**Files:**
- Modify: `functions/api/admin/applications.js`
- Modify: `public/admin/applications.html`
- Modify: `public/admin/admin-shell.js`
- Test: `test/application-admin.test.js`
- Test: new assertions in `test/application-admin.test.js` for history page size and exact lookup

**Interfaces:**
- Cursor response remains `{ items, nextCursor }` and continues to hide R2 keys and comparison hashes.
- `status=all&id=UP-…` performs exact retained-history lookup; `status=pending&id=UP-…` keeps the existing focused-review behavior.
- Page controls replace the visible list and retain cursor history for the previous-page action.

- [ ] Add tests for ten-item pages, previous/next cursor traversal across tied timestamps, exact lookup, invalid IDs, and retention-aware photo availability.
- [ ] Run `node --test test/application-admin.test.js` and confirm new assertions fail against the 50-item/append-only behavior.
- [ ] Implement ten-item pages, page-replacement navigation, exact lookup, page count copy, and rename the admin navigation group to `현황`.
- [ ] Run focused admin tests and validate mobile target sizes.

### Task 4: Full verification and deployment

**Files:**
- Verify all changed files; no new source files unless required by earlier tasks.

- [ ] Run `npm test`, `git diff --check`, JavaScript syntax checks, and `wrangler pages functions build`.
- [ ] Use Chromium to verify each public view, the delayed Turnstile request, admin list paging/search, and widths 320–1440.
- [ ] Confirm the live Turnstile frame is the source of any remaining vendor warnings; do not claim those are fixed if only deferred.
- [ ] Deploy Pages to the authorized production project and verify both hostnames and admin route guards.
