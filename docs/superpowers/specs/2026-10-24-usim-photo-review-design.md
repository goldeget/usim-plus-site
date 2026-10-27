# USIM PLUS photo submission and operator review

Date: 2026-10-24

Status: Implementation approved by the user; metadata retention ruling recorded in the implementation ledger.

## Intent

Turn the attached landing page's photo-only pre-screening form into a real submission flow. Applicants can upload a KAIT activation-status screenshot, receive a private reference and check its review status. The operator can open pending photos from the existing Access-protected admin site and mark each submission approved or rejected.

Keep the attached page's visual design. Replace copy that currently says the form is a mockup and does not transmit or store files, because those statements become false after implementation.

## Current state

The landing page is static. Its form requires a JPG or PNG, previews it in the browser, then prevents submission and shows a demo toast. It sends no request. The admin site edits public copy through D1; it has no application queue or image viewer. The existing Pages project has a D1 binding and an admin host protected by Cloudflare Access.

The repository has no R2 binding. This environment has no Cloudflare API authentication, and its restricted outbound policy does not currently allow api.cloudflare.com. The GitHub HTTPS proxy can read the repository, but that does not grant Cloudflare access.

## Goals

- Accept an image through a server endpoint and store it in a private Cloudflare R2 bucket.
- Keep only a generated submission ID, status, timestamps, object key, and a hash of a random applicant status token in D1. Do not collect an applicant name, phone number, identity document, or original filename.
- Let the applicant see a receipt and check only their submission status using the ID and token. Never expose the photo through this status endpoint.
- Add a pending-submission queue to the existing Access-protected admin site. Let the administrator open the original image through an authenticated, no-store endpoint and record one decision: approved or rejected.
- Keep a reviewed photo for 30 days after the decision. Expire unreviewed photos 30 days after submission. R2 lifecycle deletion timing is subject to Cloudflare's lifecycle processing.
- Retain only the non-image D1 receipt/status metadata for up to 30 additional days after the photo's 30-day period, then remove it with a daily scheduled Worker. Receipt status lookup ends when that metadata is deleted.
- The user selected 30 days after submission for unreviewed photos.
- Preserve the existing mobile and desktop visual layout while showing accurate collection, use, retention, and consent text.
- Keep all image reads private; never configure a public R2 domain.

## Non-goals

- Do not automatically determine telecom eligibility, verify KAIT, or make payments.
- Do not accept ID-card images or ask for resident registration numbers, authentication codes, passwords, or unrelated account details.
- Do not add applicant contact fields. The receipt token is the result lookup mechanism.
- The user asked to leave the Telegram, LINE, KakaoTalk, and Channel Talk cards disabled until real URLs are supplied.
- The collection notice uses the user-supplied details: 서울평가정보㈜, responsible person 김중근, help@climekr.com.

## Approaches

1. **Private R2 images with D1 metadata — selected by the user.** R2 fits full-size screenshots, supports private object access, and has bucket lifecycle rules. D1 holds only queue and review metadata. It requires a new bucket, Pages binding, D1 migration, and lifecycle configuration.
2. **Store image bytes in D1.** This avoids another storage service but requires a strict small-file cap, makes the existing content database hold user photos, and has no R2 lifecycle. It is a poor fit for clear full-size review and the selected 30-day policy.

## Proposed flow

1. The applicant chooses a JPG or PNG no larger than 10 MB, accepts the disclosed terms, and completes Cloudflare Turnstile. The browser previews the image locally and posts it as multipart data.
2. The function checks consent, Turnstile, content type, file signature, and size. It generates the ID and status token, hashes the token for D1, and writes the image under a random pending key in a private R2 bucket. It returns the ID and token once; the page offers a copyable receipt and status lookup.
3. The administrator opens the application queue on the admin host. API handlers recheck the configured admin email and Cloudflare Access headers; they do not rely on middleware routing alone. The image endpoint returns only an R2 object for an authorized administrator, with no-store and nosniff headers.
4. The administrator records approved or rejected once. The function copies the object to a new reviewed key to reset its R2 lifecycle age, updates the D1 status and review timestamp, then deletes the pending key. A bucket lifecycle rule expires pending and reviewed objects after 30 days from their respective creation times. Pending objects therefore expire 30 days after upload; reviewed copies expire 30 days after the decision.
5. The applicant's ID/token endpoint returns only pending, approved, rejected, or expired status. It never returns personal data or image bytes. An expired status remains available for up to 30 additional days after the photo expiry.
6. Pending metadata becomes eligible for deletion 60 days after submission and reviewed metadata becomes eligible 60 days after the decision. A daily scheduled Worker deletes eligible rows; actual deletion follows the scheduled run. Once deleted, the receipt status lookup returns not found.

## Security and data handling

- Accept only JPEG and PNG, validate file signatures on the server, enforce the 10 MB cap, and use generated object keys rather than user filenames.
- Keep the R2 bucket private and serve images only through the Access-checked admin function. Set Cache-Control: no-store and X-Content-Type-Options: nosniff.
- Require the existing admin email plus Access identity and assertion on admin API routes; require the expected admin origin for decision requests.
- Validate every database field and never place the uploaded image or tokens in application logs.
- Require Turnstile on public submissions to reduce automated uploads. Its site key and secret must be configured for the public domains.
- Tell applicants to mask unrelated sensitive details. The consent text uses the user-supplied controller and privacy contact details.
- Keep the generated ID, status, timestamps, photo key, and receipt-token hash through the 60-day cutoff after submission or decision, then remove the D1 row on a daily Cron Trigger; actual removal follows that scheduled run.

## Production prerequisites and limits

- Create the private R2 bucket named usim-plus-applications and bind it as APPLICATIONS_BUCKET in the Pages production environment.
- Configure the 30-day R2 lifecycle rule and apply the new D1 migration to the existing usim-plus-content database.
- Deploy `retention-worker.js` from `wrangler-retention.toml` with its daily Cron Trigger and the same `CONTENT_DB` binding.
- Configure Turnstile site and secret keys for climekr.com and www.climekr.com.
- The notice will name 서울평가정보㈜, 김중근, and help@climekr.com, as supplied by the user. Keep support-channel cards disabled until URLs are supplied.
- A Cloudflare API token is not present in the current environment. Production resource creation and verification need either dashboard setup by the account owner or a token supplied securely through environment settings with the required R2, D1, Pages, and Turnstile permissions. GitHub pushes may deploy code, but they cannot create or bind these resources by themselves.

## Verification

- Upload an allowed image and confirm a receipt; reject missing consent, Turnstile failure, malformed image bytes, unsupported types, oversized files, and malformed requests.
- Confirm unauthenticated users cannot list submissions, open images, or change decisions; confirm the admin can see the original image and record each decision only once.
- Confirm the applicant status lookup returns only the matching status for the correct token and rejects incorrect tokens.
- Verify the R2 bucket is private and the lifecycle policy is configured. A local test can verify date/key decisions but cannot prove Cloudflare's remote lifecycle execution.
- Verify the scheduled Worker is deployed with the daily Cron Trigger and that D1 receipt metadata is removed after its 60-day submission/decision period.
- Confirm the served landing page still uses the attached layout and that its data-collection copy matches the implemented behavior.
