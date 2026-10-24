# Simple User Offer and Admin Review

## Goal

Make the public offer understandable at first glance. A visitor should see the reward, the qualifying conditions, and one application action without choosing among several menus. Keep application status and legal details available on demand, and prevent the admin application history from growing with every loaded record.

## Current evidence

- At 390×844, the public document is 3,409 CSS pixels tall and its hero alone is 850 pixels tall.
- The public page shows the hero, the three-step list, the full application, status lookup, seven FAQs, and contact information in one long document.
- The admin history API returns 50 records per page. The browser appends pages, producing about 7,957 pixels of mobile content for 50 mocked rows and about 15,365 pixels after 100.
- The public page and middleware do not set a Content-Security-Policy and do not load WOFF/WOFF2 fonts. The reported `postMessage`, adapter, font parsing, and `data:,` CSP messages originate in the cross-origin Cloudflare Turnstile challenge frame. Do not broaden the site CSP or remove bot verification to hide vendor output.
- The Turnstile loader is currently triggered when the application form is opened or approaches the viewport, and a failed first load cannot be retried without reloading.

## Design

1. Keep the current brand mark and teal accent, but simplify the page chrome, typography, surfaces, and spacing to a calm, banking-style hierarchy without copying another company’s exact visual system.
2. Keep the public site on one landing page. Lead with `유심 개통하면 최대 51만원`, state the 3/15/30-day per-line amounts and three-line cap directly beneath it, and show one primary `참여 조건 먼저 확인하기` action that opens the conditions. Keep `이미 신청했어요? 접수 조회` as the secondary link. Show `개통 전 조건 확인 → 개통 후 사진 신청 → 유지 조건 확인 후 지급` in one compact line, and make the photo action explicit only after explaining the terms.
3. Keep payment conditions, FAQs, and contact details in the guidance view. Keep the privacy notice and consent close to the upload form. Do not add invented urgency, guaranteed payout wording, or claims that reviews are absent.
4. Keep the managed Turnstile protection. Load and execute it only after a user submits a valid photo and consent; add a retry path for configuration or script-load failures. The public page must not request the Turnstile script merely because a visitor opens or scrolls through the site.
5. Show ten admin history rows at a time, replace rows when navigating pages, and provide previous/next controls near the filters. Add exact receipt-number lookup so an operator can find a known application without browsing pages. Keep the existing mobile card layout and protected image behavior.

## Acceptance criteria

- The public landing page has no task-tab menu, one primary application action, one secondary receipt lookup, and a compact process line.
- The reward amounts, duration requirements, maximum eligible lines, and non-guarantee caveat are visible without opening the details.
- The participation conditions open from the primary action; the status lookup opens from its secondary link; an explicit post-activation photo action opens the application form; existing direct hashes still work.
- Existing direct hashes `#steps`, `#apply`, `#statusLookupDetails`, `#benefits`, `#faq`, and `#contact` resolve to the correct view.
- No Turnstile script or configuration request occurs before a valid submission attempt. A challenge failure can be retried without a reload.
- The admin API returns no more than ten rows per history page. Previous/next navigation replaces the list, filters reset pagination, and exact receipt lookup returns only the requested retained application.
- Responsive browser checks at 320, 390, 768, 1024, and 1440 pixels have no horizontal overflow or page errors.
- Report Cloudflare Turnstile frame messages separately if they still appear during an actual challenge; they cannot be suppressed safely by changing the public page’s CSP.

## Out of scope

- Changing the application’s business terms or retention periods.
- Removing Turnstile, weakening the photo endpoint, or storing additional applicant data.
- Guaranteeing search rankings or changing the operator account credentials.
