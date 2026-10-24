# Administrator Password Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unavailable Cloudflare Access email code with a secure single-operator email and password login on the admin site.

**Architecture:** Cloudflare Pages serves a public login form on the admin hostname. Pages Functions verify the configured email and encrypted `ADMIN_PASSWORD` secret, then create an 8-hour D1-backed session with an opaque HttpOnly cookie. A separate random `ADMIN_AUTH_SECRET` protects password-version and IP-throttle HMACs. Middleware and admin APIs validate the session; Cloudflare Access changes to Bypass only after the code is live and verified.

**Tech Stack:** Cloudflare Pages Functions, Cloudflare D1, Web Crypto, static HTML/CSS/JS, Node.js built-in tests.

**Spec:** `docs/superpowers/specs/2026-10-25-admin-password-auth.md`

## Global Constraints

- Never request, print, log, or commit the admin password, auth key, session token, cookie, or raw IP address.
- Keep the existing public homepage and photo review behavior unchanged.
- Protect every admin HTML page and API unless a valid admin session exists; only the login page and login endpoint are public on `admin.climekr.com`.
- Preserve the 8-hour session expiry, Secure/HttpOnly/SameSite=Strict host-only cookie, exact admin origin checks, and 10-attempt/15-minute IP throttle.
- Keep `/admin/*` inaccessible on `climekr.com` and `www.climekr.com`.
- Do not bypass Cloudflare Access until the password-auth deployment and protected route checks succeed.

## Review Focus

- Missing `ADMIN_PASSWORD`: login fails closed with a clear setup error; all private APIs remain blocked.
- Wrong email or password: identical response, bounded request body, and rate-limit accounting.
- Expired, malformed, rotated-password, or revoked session: HTML routes return to login and APIs return 401.
- Cross-origin login/logout: rejected before credential processing.
- Public hostname and direct static admin asset paths: never expose editor or review content.

---

### Task 1: D1 session store and login API

**Files:**
- Create: `migrations/0003_admin_password_auth.sql`
- Create: `functions/_lib/admin-auth.js`
- Create: `functions/api/admin/auth/login.js`
- Create: `functions/api/admin/auth/logout.js`
- Create: `test/admin-auth.test.js`
- Modify: `test-support/cloudflare.js`
- Modify: `functions/_lib/applications.js`
- Modify: `test/applications.test.js`

**Interfaces:**
- `getAdminSession(request, env) -> Promise<{ email: string } | null>` validates the host-only cookie against D1 and the current password version.
- `isAdminRequest(request, env, { requireOrigin = false }) -> Promise<boolean>` checks admin host, HTTPS, optional exact origin, and a valid session.
- Login accepts JSON `{ email, password }`; successful response is `{ ok: true, redirectTo }` and sets the session cookie.
- Logout clears the session and cookie.

- [x] **Step 1: Write failing tests** for session-only admin authorization, login cookie flags, credential mismatch, missing secret, exact origin, bounded body, per-IP lockout, password rotation, expiry, and logout.
- [x] **Step 2: Run the initial auth tests** and confirm the missing auth API fails.
- [x] **Step 3: Add additive D1 tables** for hashed session tokens and HMAC-keyed attempt windows; implement password checks, session creation/revocation, and rate limiting in `admin-auth.js` and the two auth endpoints.
- [x] **Step 4: Run the targeted auth tests** and confirm they pass.

### Task 2: Protect admin routes and add the login experience

**Files:**
- Modify: `functions/_middleware.js`
- Modify: `functions/api/admin/applications.js`
- Modify: `functions/api/admin/applications/image.js`
- Modify: `functions/api/admin/applications/review.js`
- Modify: `functions/api/content.js`
- Create: `public/admin/login.html`
- Create: `public/admin/admin-auth.js`
- Modify: `public/admin/index.html`
- Modify: `public/admin/review.html`
- Create or modify: `test/admin-middleware.test.js`
- Modify: `test/application-admin.test.js`
- Modify: `test/content-api.test.js`

**Interfaces:**
- Middleware allows only `/admin/login.html` and `/api/admin/auth/login` without a session on the admin host.
- Unauthenticated HTML paths redirect to login with a validated `/admin/...` return path; unauthenticated API paths return 401 JSON.
- All admin handlers await `isAdminRequest`; review mutations retain their exact-origin requirement.

- [x] **Step 1: Write route tests** for login page reachability, root/editor and review redirects, protected API responses, public-host 404s, and successful session access.
- [x] **Step 2: Run the route tests** and identify the login-page return-path issue.
- [x] **Step 3: Implement middleware guards, responsive login UI, safe return-path handling, login/logout client behavior, and admin page logout controls.** Replace old copy that mentions Access login.
- [x] **Step 4: Run the affected tests** and confirm all pass.

### Task 3: Retention, setup documentation, and local workflow

**Files:**
- Modify: `retention-worker.js`
- Modify: `test/retention-worker.test.js`
- Modify: `docs/cloudflare-application-review-setup.md`
- Modify: `test/cloudflare-config.test.js`
- Modify: saved cloud environment `start_skill` if needed

- [x] **Step 1: Write cleanup tests** for deleting expired sessions and old hashed-IP attempt rows while retaining unexpired rows.
- [x] **Step 2: Run the cleanup tests** and confirm they pass.
- [x] **Step 3: Extend the daily cleanup Worker and setup guide** with `ADMIN_PASSWORD` secret requirements, password rotation, Access Bypass sequencing, and session behavior.
- [x] **Step 4: Run the targeted tests** and confirm they pass.

### Task 4: Production rollout

**Files:**
- No additional source files.

- [x] **Step 1: Run `npm test` and the Pages Functions build**; confirm all tests/build pass.
- [x] **Step 2: Apply the D1 migration remotely** and verify it is recorded.
- [ ] **Step 3: Deploy the Pages code while Access still blocks unauthenticated requests.** Verify the deployment and the production binding names.
- [ ] **Step 4: Verify route guards and login page deployment** through local/browser smoke checks; then set the Access app policy to Bypass for everyone so the custom login can be reached.
- [ ] **Step 5: Remove the one-time PIN identity provider created for this admin setup.** Verify the Access app is bypassed and the login route is public while editor/review APIs remain session-protected.
- [ ] **Step 6: Stop before claiming end-to-end production login** until the user stores `ADMIN_PASSWORD` as an encrypted production Pages secret and a real login can be completed without exposing the password.
