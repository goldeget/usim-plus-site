# Public Screen Content Controls Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Let operators edit the user-visible public page wording, payout values, lookup and chat links, status-screen labels, privacy copy, and footer details from the authenticated admin editor.

**Architecture:** Extend the D1 content document with a new versioned public-screen copy section. Keep URLs validated as HTTPS, keep monetary calculations derived from editable rates/limits, and render all configured content with text nodes. Preserve the existing page layout, photo-less chat intake, receipt lookup, metadata retention, and search metadata synchronization.

**Tech Stack:** Cloudflare Pages Functions, D1 CMS, static HTML/CSS/JavaScript, Node built-in test runner.

**Spec:** User-authorized continuation: all user-visible public screen copy should be manageable through the admin console.

## Files

- `functions/api/content.js`: schema validation, safe HTTPS URL handling, and V3-to-V4 migration.
- `public/admin/content.html`: grouped, responsive public-copy controls and KST save state.
- `public/index.html`: apply the published copy to hero, benefits, links, consultation, legacy status lookup, privacy disclosure, footer, and user feedback.
- `test/content-api.test.js`, `test/public-page.test.js`, `test/seo.test.js`: migration, input bounds, rendered content and link safety.
- `docs/README.md`: operational editing and immutability boundaries.

## Steps

- [x] Write failing tests for V4 content shape, old content migration preserving operator copy and links, bounded payout values/derived totals, HTTPS URL checks, admin update/save, public rendering and safe text insertion.
- [x] Verify red for each new behavior.
- [x] Implement schema defaults and migration preserving existing V3 headline, intro, checklist, FAQ and links while replacing only known obsolete intake instructions.
- [x] Add admin fields for public display copy, payout schedule and maximum cases, lookup URL, chat links, status wording, contact details and footer; factual privacy statements and retention duration stay fixed to actual system behavior.
- [x] Apply editor content across all public sections, dynamic status labels, server-rendered search/social metadata, and toasts without HTML injection.
- [x] Verify the editor and public page at mobile and desktop sizes, preserved lookup/chat workflow, full tests, and local Pages runtime.
- [ ] Verify the production page after release.
