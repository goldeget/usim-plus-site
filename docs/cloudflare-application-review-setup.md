# Cloudflare application photo review setup

This site fails closed when the application store or Turnstile keys are missing. Complete these steps in the Cloudflare account that owns the Pages project before accepting production photos.

## 1. Create and bind the private photo bucket

1. Create an R2 bucket named `usim-plus-applications`.
2. Keep public access disabled. Do not attach an `r2.dev` URL, custom domain, or public bucket policy.
3. Choose an APAC storage location if the account offers a location selector, then record the configured R2 and D1 processing/storage regions for the privacy notice.
4. Add a Pages production R2 binding named `APPLICATIONS_BUCKET` pointing to this bucket. The checked-in `wrangler.toml` declares the same binding for local and Wrangler deployments.

## 2. Set the 30-day image lifecycle rules

Add two enabled lifecycle rules, each matching the full prefix and deleting objects 30 days after upload/creation:

| Prefix | Expiration | Meaning |
| --- | --- | --- |
| `pending/` | 30 days | Unreviewed submission photos expire 30 days after receipt. |
| `reviewed/` | 30 days | Approved/rejected photos expire 30 days after the review copy is created. |

The review API copies the image into `reviewed/` before changing the D1 status. Lifecycle deletion is asynchronous, so the exact deletion time may be later than the 30-day threshold. Do not create a lifecycle rule for the bucket root; only these two prefixes should be expired.

## 3. Apply the D1 migration

The existing database is `usim-plus-content`. Keep the `CONTENT_DB` binding and apply the migration from the repository root:

```bash
npx wrangler d1 migrations apply usim-plus-content --remote
```

The migration adds opaque submission IDs, token hashes, object keys, MIME types, byte sizes, keyed source-IP comparison values, exact image SHA-256 values, review status, and timestamps. Raw IP addresses and uploaded image bytes are not stored in D1.

## 4. Deploy the daily receipt-metadata cleanup Worker

Deploy `retention-worker.js` as a separate Worker after applying the D1 migration:

```bash
npx wrangler deploy --config wrangler-retention.toml
```

`wrangler-retention.toml` binds the Worker to the existing `usim-plus-content` database and schedules cleanup daily at `03:17 KST` (`18:17 UTC`, because Cloudflare Cron uses UTC). Pending rows become eligible for deletion 60 days after submission; reviewed rows become eligible 60 days after the decision. Actual deletion time follows the scheduled run. Applicants can see `expired` during this period; after the D1 row is deleted, status lookup returns not found.

## 5. Configure Turnstile and password-based admin access

1. Create a Turnstile widget that allows `climekr.com` and `www.climekr.com`.
2. Set the Pages production variable `TURNSTILE_SITE_KEY` to its public site key.
3. Set `TURNSTILE_SECRET_KEY` as an encrypted Pages secret. Never commit either key to this repository. Turnstile test keys are for local testing only.
4. Set `ADMIN_EMAIL` as an encrypted Pages Production Secret. The configured operator email is `4tencpkr@gmail.com`.
5. Have the operator choose a unique password of at least 12 characters and set it as the encrypted Pages Production Secret `ADMIN_PASSWORD`. Do not put the password in code, deployment logs, or chat.
6. Set `ADMIN_AUTH_SECRET` as an encrypted Pages Production Secret using at least 32 random bytes. Generate it with `openssl rand -base64 48`; pipe the output directly into `npx wrangler pages secret put ADMIN_AUTH_SECRET --project-name usim-plus-site` so the value is never printed or saved in a file. This key protects the password-version and IP-throttle hashes and must stay independent from the password.
7. Keep Cloudflare Access in place through the code and D1 migration deployment. Run the auth and route-guard checks first. After they pass, set the `USIM Plus Admin` Access application to Bypass for Everyone; the Pages middleware and every admin API enforce the D1-backed session. Immediately verify production: `/admin/login` returns 200, `/` redirects to login, and unauthenticated admin APIs return 401. If any check fails, restore the previous Access allow policy before proceeding. Keep any ACME challenge exception path-scoped.
8. After production route checks pass, remove the unused one-time PIN identity provider. Set the `ADMIN_PASSWORD` production Secret if it is not already set, then confirm `https://admin.climekr.com/` opens the operations dashboard, `/admin/review.html` opens the photo queue, and `/admin/content.html` opens the content editor after email/password login. Use the logout button to end the session.

The login is available only on `admin.climekr.com`, requires the exact same-origin POST, and creates an eight-hour secure HttpOnly session. Changing the password invalidates existing sessions. Login is limited to ten attempts per IP in 15 minutes; only a keyed hash of the address is stored.

## 6. Verify before opening public submissions

After deployment, verify all of the following with a real Turnstile challenge and a harmless test screenshot:

- A consented JPEG and PNG submission returns one receipt ID and one receipt token.
- Unsupported content, mismatched image signatures, files over 10 MiB, missing consent, and failed Turnstile challenges are rejected.
- The receipt ID/token returns only pending, approved, rejected, or expired status. A wrong token returns no submission details.
- Public and `pages.dev` hosts cannot access admin pages or APIs. A request without a current password-authenticated session cannot list the queue, open photos, edit content, or decide applications.
- The admin can view the original image and record one approval or rejection. The reviewed image is under `reviewed/`; the previous `pending/` key is removed.
- The R2 bucket has no public URL, and both lifecycle rules are enabled.
- The `usim-plus-application-retention` Worker is deployed with its daily Cron Trigger, the same D1 binding, and the private R2 binding. It removes reviewed-prefix objects that are not referenced by a submission record.
- D1 receipt metadata becomes eligible for deletion after 60 days from submission or review; the daily scheduled run deletes it, after which status lookup returns not found.
- The public disclosure names `에스씨아이평가정보(주)`, `임동훈`, `help@climekr.com`, Cloudflare storage, the image purpose, the two 30-day image-retention cases, keyed IP and image-hash comparison, and the 60-day metadata period. It explains that raw IP is not stored and an IP match alone does not identify the same person.

Email at `help@climekr.com` is the only published support channel until other support URLs are provided.

## 7. Make the public site discoverable

- The public hostname uses `https://climekr.com/` as its canonical address. `www.climekr.com` redirects to it; Pages preview hosts send `noindex`. `https://climekr.com/sitemap.xml` lists the public landing page; `https://climekr.com/robots.txt` points crawlers to that sitemap and excludes admin/API paths.
- `https://admin.climekr.com/robots.txt` disallows crawling across the admin hostname. Admin pages also use `noindex` and require a password session.
- The public page includes Korean title/description/social metadata and structured organization, service, and FAQ information. Brand spelling variants (`클라임유심`, `climekr`, `climekr유심`, `climekr 유심`) and related application/review search queries are used in relevant content. `https://climekr.com/llms.txt` summarizes the service and its limits for AI crawlers.
- After the new deployment is live, submit `https://climekr.com/sitemap.xml` in Google Search Console and Naver Search Advisor. Both services require you to verify domain ownership first; add their TXT verification records to the `climekr.com` Cloudflare DNS zone, then complete verification in each service.
- The hosted IndexNow verification file is `https://climekr.com/2cc7263262b5a365ad26c37e214acd2b.txt`. The public home URL can then be submitted to the IndexNow endpoint to notify participating search engines. IndexNow and sitemap submission request crawling; neither controls ranking or guarantees how an AI system answers.
