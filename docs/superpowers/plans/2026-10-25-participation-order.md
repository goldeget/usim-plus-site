# Participation Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public flow say and behave as condition check before activation, photo submission after activation, and payout after qualifying conditions.

**Architecture:** Keep the existing three-step CMS schema and photo application endpoint. Update public copy and the hero CTA target, align default CMS/SEO/AI text, and guard the order with existing Node tests.

**Tech Stack:** Static HTML, Cloudflare Pages Functions, Node.js built-in test runner, Wrangler Pages deployment.

**Spec:** `docs/superpowers/specs/2026-10-25-participation-order-design.md`

## Global Constraints

- Preserve the current offer amounts, eligibility details, retention terms, photo review and application endpoint.
- Use exactly three CMS-managed summary steps.
- Do not claim that Climekr or the telecom provider guarantees activation or payout.
- Make the first homepage action open participation conditions; photo submission must be labeled as post-activation.

## Review Focus

- Visitor sees the guidance expanded from the hero CTA, not a photo upload form.
- Visitor is told to check participation, price and contract terms before activation.
- A photo is described as post-activation evidence.
- API defaults, admin defaults, and SEO/AI summaries use consistent order.
- Existing status lookup and direct `#apply` links keep working.

### Task 1: Update and verify the public participation order

**Files:**
- Modify: `test/public-page.test.js`
- Modify: `test/content-api.test.js`
- Modify: `test/seo.test.js`
- Modify: `public/index.html`
- Modify: `functions/api/content.js`
- Modify: `public/admin/content.html`
- Modify: `public/llms.txt`
- Modify: `docs/superpowers/specs/2026-10-25-compact-navigation.md`

- [x] Update behavior tests for the pre-activation CTA, ordered summary and post-activation photo instruction.
- [x] Run affected tests and confirm they fail on today's misleading flow.
- [x] Update public page, CMS defaults, SEO, AI guide and the prior design note to agree on one sequence.
- [x] Run all tests and inspect the diff for content inconsistencies.
- [x] Deploy with Wrangler Pages to the existing production project and verify the public homepage and content API return the new flow.
