import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readProjectFile = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("binds the application photo store to the named private R2 bucket", async () => {
  const config = await readProjectFile("wrangler.toml");
  assert.match(config, /binding\s*=\s*"APPLICATIONS_BUCKET"/);
  assert.match(config, /bucket_name\s*=\s*"usim-plus-applications"/);
  assert.match(config, /binding\s*=\s*"CONTENT_DB"/);
  assert.match(config, /pages_build_output_dir\s*=\s*"public"/);
});

test("documents the required private R2 lifecycle, Turnstile, and Access configuration", async () => {
  const docs = await readProjectFile("docs/cloudflare-application-review-setup.md");
  for (const content of ["pending/", "reviewed/", "30", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "ADMIN_EMAIL", "public bucket policy"]) {
    assert.ok(docs.includes(content), `missing production setup instruction: ${content}`);
  }
  assert.ok(docs.includes("retention-worker.js"));
  assert.ok(docs.includes("wrangler-retention.toml"));
  assert.ok(docs.includes("60 days"));
  assert.ok(docs.includes("Cron Trigger"));
  assert.ok(docs.includes("deletion time follows the scheduled run"));
  assert.equal(docs.includes("at most 30 days after the photo's 30-day retention window"), false);
});

test("describes the photo-only collection accurately in the repository README", async () => {
  const readme = await readProjectFile("README.md");
  assert.ok(readme.includes("application photo flow"));
  assert.equal(readme.includes("collects identity documents"), false);
  assert.equal(readme.includes("신분증"), false);
});
