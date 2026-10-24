# Compact User and Admin Navigation

## Goal

Make the public site understandable at first glance, keep each task to a focused view, and prevent the admin application history from growing with every loaded record.

## Current evidence

- At 390×844, the public document is 3,409 CSS pixels tall and its hero alone is 850 pixels tall.
- The public page shows the hero, the three-step list, the full application, status lookup, seven FAQs, and contact information in one long document.
- The admin history API returns 50 records per page. The browser appends pages, producing about 7,957 pixels of mobile content for 50 mocked rows and about 15,365 pixels after 100.
- The public page and middleware do not set a Content-Security-Policy and do not load WOFF/WOFF2 fonts. The reported `postMessage`, adapter, font parsing, and `data:,` CSP messages originate in the cross-origin Cloudflare Turnstile challenge frame. Do not broaden the site CSP or remove bot verification to hide vendor output.
- The Turnstile loader is currently triggered when the application form is opened or approaches the viewport, and a failed first load cannot be retried without reloading.

## Design

1. Keep the current brand mark and teal accent, but simplify the page chrome, typography, surfaces, and spacing to a calm, banking-style hierarchy without copying another company’s exact visual system.
2. Split the public service into four linked views: `참여 방법`, `사진 신청`, `상태 조회`, and `자세한 안내`. The first view presents the three steps and the first official lookup action. Direct links and existing hashes continue to work.
3. Keep payment conditions, FAQs, and contact details in the guidance view. Keep the privacy notice and consent close to the upload form. Do not add invented urgency, guaranteed payout wording, or claims that reviews are absent.
4. Keep the managed Turnstile protection. Load and execute it only after a user submits a valid photo and consent; add a retry path for configuration or script-load failures. The public page must not request the Turnstile script merely because a visitor opens or scrolls through the site.
5. Show ten admin history rows at a time, replace rows when navigating pages, and provide previous/next controls near the filters. Add exact receipt-number lookup so an operator can find a known application without browsing pages. Keep the existing mobile card layout and protected image behavior.

## Acceptance criteria

- The default public view and each task view do not include unrelated panels in their layout; on mobile the document remains within one task view plus the shared header/footer.
- Public CTA order is explicit: official KAIT lookup, photo precheck, receipt-status lookup. Each action opens the matching view, and the photo/status forms still work.
- Existing direct hashes `#steps`, `#apply`, `#statusLookupDetails`, `#benefits`, `#faq`, and `#contact` resolve to the correct view.
- No Turnstile script or configuration request occurs before a valid submission attempt. A challenge failure can be retried without a reload.
- The admin API returns no more than ten rows per history page. Previous/next navigation replaces the list, filters reset pagination, and exact receipt lookup returns only the requested retained application.
- Responsive browser checks at 320, 390, 768, 1024, and 1440 pixels have no horizontal overflow or page errors.
- Report Cloudflare Turnstile frame messages separately if they still appear during an actual challenge; they cannot be suppressed safely by changing the public page’s CSP.

## Out of scope

- Changing the application’s business terms or retention periods.
- Removing Turnstile, weakening the photo endpoint, or storing additional applicant data.
- Guaranteeing search rankings or changing the operator account credentials.
