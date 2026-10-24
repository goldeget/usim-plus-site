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

test("declares the password-session schema and safe Pages secret setup", async () => {
  const migration = await readProjectFile("migrations/0003_admin_password_auth.sql");
  const docs = await readProjectFile("docs/cloudflare-application-review-setup.md");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_sessions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_login_attempts/);
  for (const content of ["ADMIN_PASSWORD", "ADMIN_AUTH_SECRET", "4tencpkr@gmail.com", "Bypass for Everyone", "password-authenticated session"]) {
    assert.ok(docs.includes(content), `missing admin authentication setup instruction: ${content}`);
  }
});

test("documents and migrates privacy-preserving duplicate-review signals", async () => {
  const migration = await readProjectFile("migrations/0004_application_review_signals.sql");
  const readme = await readProjectFile("README.md");
  assert.match(migration, /ADD COLUMN source_ip_hash TEXT/);
  assert.match(migration, /ADD COLUMN image_hash TEXT/);
  assert.match(migration, /application_submissions_source_ip_hash/);
  assert.match(migration, /application_submissions_image_hash/);
  assert.match(readme, /raw source IP is not stored/i);
  assert.match(readme, /never automatically approved or rejected/);
});

test("describes the photo-only collection accurately in the repository README", async () => {
  const readme = await readProjectFile("README.md");
  assert.ok(readme.includes("application photo flow"));
  assert.equal(readme.includes("collects identity documents"), false);
  assert.equal(readme.includes("신분증"), false);
});
