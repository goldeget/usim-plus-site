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

The migration adds only opaque submission IDs, token hashes, object keys, MIME types, byte sizes, review status, and timestamps. It does not store the uploaded image bytes.

## 4. Deploy the daily receipt-metadata cleanup Worker

Deploy `retention-worker.js` as a separate Worker after applying the D1 migration:

```bash
npx wrangler deploy --config wrangler-retention.toml
```

`wrangler-retention.toml` binds the Worker to the existing `usim-plus-content` database and schedules cleanup daily at `03:17 KST` (`18:17 UTC`, because Cloudflare Cron uses UTC). Pending rows become eligible for deletion 60 days after submission; reviewed rows become eligible 60 days after the decision. Actual deletion time follows the scheduled run. Applicants can see `expired` during this period; after the D1 row is deleted, status lookup returns not found.

## 5. Configure Turnstile and admin access

1. Create a Turnstile widget that allows `climekr.com` and `www.climekr.com`.
2. Set the Pages production variable `TURNSTILE_SITE_KEY` to its public site key.
3. Set `TURNSTILE_SECRET_KEY` as an encrypted Pages secret. Never commit either key to this repository. Turnstile test keys are for local testing only.
4. Confirm `ADMIN_EMAIL` is set to the operator's permitted email.
5. In Cloudflare Access, protect all paths on `admin.climekr.com`; permit only the intended operator. Keep the existing ACME challenge exception path-scoped.
6. Confirm `https://admin.climekr.com/` opens the content editor and `https://admin.climekr.com/admin/review.html` opens the photo queue after Access login.

The Functions independently check the host, `ADMIN_EMAIL`, Access identity and assertion; decision requests also require the exact admin origin.

## 6. Verify before opening public submissions

After deployment, verify all of the following with a real Turnstile challenge and a harmless test screenshot:

- A consented JPEG and PNG submission returns one receipt ID and one receipt token.
- Unsupported content, mismatched image signatures, files over 10 MiB, missing consent, and failed Turnstile challenges are rejected.
- The receipt ID/token returns only pending, approved, rejected, or expired status. A wrong token returns no submission details.
- Public and `pages.dev` hosts cannot access admin pages or APIs. A non-admin Access identity cannot list the queue, open photos, or decide applications.
- The admin can view the original image and record one approval or rejection. The reviewed image is under `reviewed/`; the previous `pending/` key is removed.
- The R2 bucket has no public URL, and both lifecycle rules are enabled.
- The `usim-plus-application-retention` Worker is deployed with its daily Cron Trigger.
- D1 receipt metadata becomes eligible for deletion after 60 days from submission or review; the daily scheduled run deletes it, after which status lookup returns not found.
- The public disclosure names `에스씨아이평가정보(주)`, `임동훈`, `help@climekr.com`, Cloudflare storage, the image purpose, and the two 30-day image-retention cases.

The page deliberately leaves Telegram, LINE, KakaoTalk, and Channel Talk inactive until real support URLs are configured.
