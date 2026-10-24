# Administrator Email and Password Login

## Context

Cloudflare Access has no identity provider configured that can issue a login challenge reliably. The configured email one-time PIN is not arriving. The operator explicitly asked for a normal email and password form on the administrator site.

## Decision

Use a single operator account on `admin.climekr.com`. The encrypted `ADMIN_EMAIL` Pages secret is the username. The operator chooses a unique password and stores it as the encrypted production Pages secret `ADMIN_PASSWORD`. A separate random `ADMIN_AUTH_SECRET` signs password-version and IP-throttle hashes; it is generated and stored as an encrypted Pages secret. Do not request or print the password or auth secret in chat.

Cloudflare Access will bypass the admin hostname after the application login is deployed. The Pages middleware and admin APIs will enforce the application session on every private route. The public hostname will continue to return 404 for `/admin/*`.

## Session and password handling

- Accept only the configured email and the `ADMIN_PASSWORD` secret; compare both values without revealing which field failed.
- Require the exact `https://admin.climekr.com` origin for login and logout requests.
- Limit a connecting IP to 10 login attempts in a 15-minute window. Store only an HMAC of the IP, never the raw address.
- Generate 256-bit random session tokens. Store only SHA-256 token hashes in D1, with an 8-hour expiry.
- Set the cookie as `__Host-usim_admin_session`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, with no `Domain` attribute.
- Logout deletes the D1 session and clears the cookie. Password rotation invalidates sessions through a keyed password-version value.
- Never log passwords, session tokens, cookies, or IP addresses.
- If `ADMIN_PASSWORD` or `ADMIN_AUTH_SECRET` is absent, the login endpoint fails closed and the form explains that the production password secret must be configured.

## User experience

- `/admin/login` is the only public page on the admin hostname (`public/admin/login.html` is the source file).
- `/` opens the content editor for a logged-in operator; `/admin/review.html` opens photo review.
- Unauthenticated browser requests redirect to the login form with a validated same-host return path. Unauthenticated APIs return JSON 401.
- The login page matches the existing dark navy and teal admin styling, is responsive, and uses email/password autocomplete semantics.
- Both admin pages expose a logout control.

## Storage and operations

Add D1 tables for hashed sessions and hashed-IP login throttling. The existing daily retention Worker removes expired sessions and old throttling rows. The application password is never stored in D1.

The user must add the chosen password as the `ADMIN_PASSWORD` encrypted production secret in Cloudflare Pages. The production deployment must be refreshed after the secret is saved. Switch the existing Access application to bypass only after the custom auth middleware and routes are deployed and verified. Remove the one-time PIN provider created for this admin app once the switch is complete.

## Verification

- Unit tests cover successful login, wrong email/password, missing secret, request size, origin checks, lockout, cookie flags, session expiry, logout revocation, password rotation, and all admin route guards.
- Browser smoke tests cover login form rendering, successful mocked login, editor/review navigation, and logout without changing the existing admin visual language.
- Full existing test suite, Pages Functions build, D1 migration, and production deployment are verified before switching Access.
- Production auth is not considered ready until `ADMIN_PASSWORD` is set and a real login succeeds. The password itself is not supplied to the agent.
