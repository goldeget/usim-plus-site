import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";

const retentionFile = "../retention-worker.js";

function row(id, { status = "pending", createdDaysAgo = 1, reviewedDaysAgo = null } = {}) {
  const createdAt = new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000).toISOString();
  const reviewedAt = reviewedDaysAgo === null ? null : new Date(Date.now() - reviewedDaysAgo * 24 * 60 * 60 * 1000).toISOString();
  return { id, status, created_at: createdAt, reviewed_at: reviewedAt, token_hash: "a".repeat(64), object_key: `pending/${id}.jpg`, content_type: "image/jpeg", size_bytes: 8 };
}

test("deletes pending metadata 60 days after submission and reviewed metadata 60 days after decision", async () => {
  const env = createMemoryCloudflare();
  env.rows.set("old-pending", row("old-pending", { createdDaysAgo: 61 }));
  env.rows.set("recent-pending", row("recent-pending", { createdDaysAgo: 59 }));
  env.rows.set("old-reviewed", row("old-reviewed", { status: "approved", createdDaysAgo: 90, reviewedDaysAgo: 61 }));
  env.rows.set("recent-reviewed", row("recent-reviewed", { status: "rejected", createdDaysAgo: 80, reviewedDaysAgo: 59 }));
  const { purgeExpiredApplicationMetadata } = await import(retentionFile);
  const result = await purgeExpiredApplicationMetadata(env, Date.now());
  assert.equal(result.meta.changes, 2);
  assert.equal(env.rows.has("old-pending"), false);
  assert.equal(env.rows.has("old-reviewed"), false);
  assert.equal(env.rows.has("recent-pending"), true);
  assert.equal(env.rows.has("recent-reviewed"), true);
});

test("scheduled handler runs the metadata purge against the bound D1 database", async () => {
  const env = createMemoryCloudflare();
  env.rows.set("expired-pending", row("expired-pending", { createdDaysAgo: 61 }));
  const worker = (await import(retentionFile)).default;
  await worker.scheduled({}, env, {});
  assert.equal(env.rows.has("expired-pending"), false);
});

test("purges expired login sessions and old hashed-IP throttling records", async () => {
  const env = createMemoryCloudflare();
  const now = Date.now();
  env.adminSessions.set("a".repeat(64), { token_hash: "a".repeat(64), password_version: "b".repeat(64), created_at: new Date(now - 9 * 60 * 60 * 1000).toISOString(), expires_at: new Date(now - 60_000).toISOString() });
  env.adminSessions.set("c".repeat(64), { token_hash: "c".repeat(64), password_version: "b".repeat(64), created_at: new Date(now - 60_000).toISOString(), expires_at: new Date(now + 60_000).toISOString() });
  env.adminLoginAttempts.set("d".repeat(64), { ip_hash: "d".repeat(64), window_started_at: new Date(now - 25 * 60 * 60 * 1000).toISOString(), attempts: 10, updated_at: new Date(now - 25 * 60 * 60 * 1000).toISOString() });
  env.adminLoginAttempts.set("e".repeat(64), { ip_hash: "e".repeat(64), window_started_at: new Date(now - 5 * 60 * 1000).toISOString(), attempts: 2, updated_at: new Date(now - 5 * 60 * 1000).toISOString() });
  const { purgeExpiredAdminAuth } = await import(retentionFile);
  const result = await purgeExpiredAdminAuth(env, now);
  assert.deepEqual(result, { sessions: 1, attempts: 1 });
  assert.equal(env.adminSessions.has("a".repeat(64)), false);
  assert.equal(env.adminSessions.has("c".repeat(64)), true);
  assert.equal(env.adminLoginAttempts.has("d".repeat(64)), false);
  assert.equal(env.adminLoginAttempts.has("e".repeat(64)), true);
});
