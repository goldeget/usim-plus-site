# Scoped fix-wave re-review

Scope: the frozen fix wave over `19295126fecb9b44a9472c1ce136d750a6f10f49`, supplied `fix-wave-review.diff`/`.stat`, appended implementation report, and the new `functions/links/index.js` inspected directly. That new route is untracked and therefore absent from the supplied diff/stat; include it when preserving this wave. This is one scoped re-review, not another whole-branch audit.

**All five original findings: ADDRESSED.** No new functional/security blocker found. One minor new copy-field mismatch is identified below.

| Original finding | Verdict | Evidence |
| --- | --- | --- |
| 1. Guide stale amounts/operator; privacy contact | ADDRESSED | `public/guide/index.html:84` and `:85` remove redundant fixed monetary claims while retaining the CMS payout band/table. Its footer at `:120` now binds company, registration, email text and href. `public/disclosures/privacy/index.html:26` binds both inquiry email text and href; the original operator row is also bound. |
| 2. Home first HTML stale payout/links | ADDRESSED | `functions/index.js:178`–`:191` binds Telegram/ChannelTalk, both lookup hrefs, headline and footer tokens from the existing single content load. Existing operator bindings remain. Safe text/attribute escaping is preserved; no extra DB query was added. The original two-case payout inconsistency is removed. A minor label-field issue in the newly added binding is noted separately below. |
| 3. Links factual/CMS integration omitted | ADDRESSED | New `functions/links/index.js` delegates to the shared renderer; the role exists in `PUBLIC_PAGES`. `public/links/index.html:37` provides definition, confirmed costs, conditional participation/payment, current-condition link and source. Operator/contact/footer navigation are bound and updated. `:11` retains `noindex,follow`, and the renderer does not override it. Client handling at `:53`–`:57` skips empty/malformed/unsafe Telegram individually and accepts valid custom HTTPS ChannelTalk hosts without blocking the second entry. |
| 4. Mobile bare line breaks hidden | ADDRESSED | The obsolete `.hero-intro br { display:none }` rule is removed from `public/user-flow.css`. The emitted bare `<br>` is no longer hidden at or below 760px. Optional `.pc`/`.mo` breaks remain independently controlled. |
| 5. llms retention triggers incorrect | ADDRESSED | `functions/llms.txt.js:3` and `public/llms.txt:49` now separately state reviewed photos: 30 days after decision; unreviewed photos: 30 days after receipt; status information: 60 days. No deletion logic changed. |

## New issue limited to the fix diff

**P3 — Use the existing CMS copy field for the newly bound contact lookup label.** At `functions/index.js:190`, `#contactLookupLabel` is populated from `content.lookup.label`. Existing browser hydration at `public/index.html:932` populates that same element from the separately editable `content.copy.contactLookupLabel` plus ` ↗`. A valid CMS record with different values for these two fields therefore displays a different contact-link label before and after hydration, and the no-JS response ignores the saved contact-specific label. Use `content.copy.contactLookupLabel + ' ↗'` in the SSR binding to match the existing client contract, and adjust the new metadata test to use distinct values so it verifies the intended field. The current test expects the lookup-button field and consequently enshrines this mismatch. This does not break the target URL, payout, or security boundary.

## Verification boundary

Read the changed source, route, bindings and new regression assertions. No tests were rerun and no browser/DB checks were initiated. The implementation report records 229/229 passing tests; the parent is independently running the full suite and actual-D1/no-JS checks. This review does not claim their results. External AI, registration, production deployment and live indexing were not rechecked or reclassified.

Only this review artifact was written. No product code, tests, commits, subagents or external writes were performed.

## P3 correction closeout

**P3: ADDRESSED. Final scoped verdict: PASS; all five original findings and the additional label mismatch are resolved.** Inspected only the requested correction: `functions/index.js:190` now writes `${content.copy.contactLookupLabel} ↗` using escaped text, matching browser hydration at `public/index.html:932`. The regression fixture at `test/public-content-metadata.test.js:270` assigns distinct lookup-button and contact-link labels, and its assertion at `:273` checks the contact-specific value and arrow. No tests were rerun. Reported targeted 6/6 and full 229/229 results remain parent/implementer evidence. This closeout does not assess the separately requested hero/floating-CTA UX work.
