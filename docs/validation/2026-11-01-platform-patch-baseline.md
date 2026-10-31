# Baseline — 2026-11-01

- Repository HEAD: 7c0ee68ea8a66fd160d39838ca36d7ff21a0b109.
- Branch: feat/platform-facts-typography-20261101; original branch work.
- npm test: 202 individual tests pass, 0 failures, 0 skipped.
- GitHub read: origin HEAD accessible, same SHA.
- Three planning/research documents were restored as untracked files and are preserved in the first checkpoint.
- Protected content hashes: 2026-11-01-protected-assets.json.
- Research/live HTTP, screenshots and later implementation verification recorded separately. No production write or deploy.

- Local D1 migrations: no pending migrations; existing local state retained.
- Local Pages server: compiled Functions; D1/R2 bindings available. Wrangler uses fallback Request.cf metadata (external fetch unavailable).
- Chromium baseline: 8 footer/home pages × widths360/1440, all HTTP200, no document overflow at these widths.
- Screenshots: /workspace/.tools/clime-validation/before; machine-readable baseline /workspace/.tools/clime-validation/baseline.json.
- Browser executables: system Chromium available; Playwright Firefox/WebKit executables missing.

- Protected manifest expanded to include all tracked public/reviews/data files, with hashes read from immutable base commit7c0ee68 (not from edited working files). Current comparison passes.
