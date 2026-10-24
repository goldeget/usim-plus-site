import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { createAdminEnvironment, createAdminSessionHeaders } from "../test-support/admin-auth.js";

const imageBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x00, 0xff, 0xd9]);

function makeId(seed = "A") { return `UP-${seed.repeat(22)}`; }

async function seedSubmission(env, { id = makeId(), ageDays = 1, status = "pending" } = {}) {
  const createdAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString();
  const objectKey = `pending/${id.slice(3)}.jpg`;
  env.rows.set(id, { id, token_hash: "a".repeat(64), object_key: objectKey, content_type: "image/jpeg", size_bytes: imageBytes.byteLength, status, created_at: createdAt, reviewed_at: status === "pending" ? null : createdAt });
  await env.APPLICATIONS_BUCKET.put(objectKey, imageBytes, { httpMetadata: { contentType: "image/jpeg" }, customMetadata: { submissionId: id } });
  return env.rows.get(id);
}

async function callQueue(env, { headers = env.adminHeaders, cursor = "" } = {}) {
  const { onRequest } = await import("../functions/api/admin/applications.js");
  return onRequest({ request: new Request(`https://admin.climekr.com/api/admin/applications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { headers }), env });
}

async function callImage(env, id, headers = env.adminHeaders) {
  const { onRequest } = await import("../functions/api/admin/applications/image.js");
  return onRequest({ request: new Request(`https://admin.climekr.com/api/admin/applications/image?id=${encodeURIComponent(id)}`, { headers }), env });
}

async function callReview(env, id, decision, { headers = env.adminHeaders, origin = "https://admin.climekr.com" } = {}) {
  const { onRequest } = await import("../functions/api/admin/applications/review.js");
  return onRequest({
    request: new Request("https://admin.climekr.com/api/admin/applications/review", {
      method: "POST",
      headers: { ...headers, origin, "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision })
    }),
    env
  });
}

async function adminEnv(options) {
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare(options), email: "admin@example.test" });
  env.adminHeaders = await createAdminSessionHeaders(env);
  return env;
}

test("denies queue, image, and decision requests without an application session", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env);
  assert.equal((await callQueue(env, { headers: {} })).status, 401);
  assert.equal((await callImage(env, row.id, {})).status, 401);
  assert.equal((await callReview(env, row.id, "approved", { headers: {} })).status, 401);
});

test("ignores forged Cloudflare Access headers without an application session", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env);
  const headers = { "cf-access-authenticated-user-email": "admin@example.test", "cf-access-jwt-assertion": "forged" };
  assert.equal((await callQueue(env, { headers })).status, 401);
  assert.equal((await callImage(env, row.id, headers)).status, 401);
  assert.equal((await callReview(env, row.id, "approved", { headers })).status, 401);
});

test("lists only fresh pending items without exposing R2 keys or receipt hashes", async () => {
  const env = await adminEnv();
  const pending = await seedSubmission(env, { id: makeId("B") });
  await seedSubmission(env, { id: makeId("C"), ageDays: 31 });
  await seedSubmission(env, { id: makeId("D"), status: "approved" });
  const response = await callQueue(env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.items.length, 1);
  assert.deepEqual(data.items[0], {
    id: pending.id,
    status: "pending",
    createdAt: pending.created_at,
    contentType: "image/jpeg",
    sizeBytes: imageBytes.byteLength
  });
  assert.equal(JSON.stringify(data).includes("object_key"), false);
  assert.equal(JSON.stringify(data).includes("token_hash"), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("paginates the review queue without skipping same-time submissions", async () => {
  const env = await adminEnv();
  const createdAt = new Date().toISOString();
  for (let i = 0; i < 51; i += 1) {
    const id = `UP-${String(i).padStart(22, "0")}`;
    env.rows.set(id, { id, token_hash: "a".repeat(64), object_key: `pending/${i}.jpg`, content_type: "image/jpeg", size_bytes: 8, status: "pending", created_at: createdAt, reviewed_at: null });
  }
  const first = await (await callQueue(env)).json();
  assert.equal(first.items.length, 50);
  assert.ok(first.nextCursor);
  const second = await (await callQueue(env, { cursor: first.nextCursor })).json();
  assert.equal(second.items.length, 1);
  assert.equal(second.items[0].id, `UP-${String(50).padStart(22, "0")}`);
  assert.equal(second.nextCursor, null);
});

test("serves an original image only to an authorized administrator with private headers", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("E") });
  const response = await callImage(env, row.id);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), imageBytes);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-disposition"), /inline/);
});

test("approves a pending photo once and starts a fresh 30-day R2 object age", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("F"), ageDays: 20 });
  const response = await callReview(env, row.id, "approved");
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, "approved");
  assert.ok(result.reviewedAt);
  assert.equal(row.status, "approved");
  assert.match(row.object_key, /^reviewed\//);
  assert.equal(env.objects.has(row.object_key), true);
  assert.equal(env.objects.has(`pending/${row.id.slice(3)}.jpg`), false);
});

test("rejects wrong origins and invalid decisions without changing the queue", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("G") });
  assert.equal((await callReview(env, row.id, "approved", { origin: "https://evil.example" })).status, 401);
  assert.equal((await callReview(env, row.id, "pending")).status, 400);
  assert.equal(row.status, "pending");
});

test("bounds the admin decision body stream when Content-Length is missing", async () => {
  const env = await adminEnv();
  const { onRequest } = await import("../functions/api/admin/applications/review.js");
  let cancelled = false;
  let closeTimer;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1025));
      closeTimer = setTimeout(() => controller.close(), 50);
    },
    cancel() { cancelled = true; clearTimeout(closeTimer); }
  });
  const request = new Request("https://admin.climekr.com/api/admin/applications/review", {
    method: "POST",
    headers: { ...env.adminHeaders, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
    body: stream,
    duplex: "half"
  });
  const response = await onRequest({ request, env });
  assert.equal(request.headers.has("content-length"), false);
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
});

test("does not allow a second, different review decision", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("H") });
  assert.equal((await callReview(env, row.id, "approved")).status, 200);
  assert.equal((await callReview(env, row.id, "rejected")).status, 409);
  assert.equal(row.status, "approved");
});

test("removes the copied object if the conditional D1 decision fails", async () => {
  const env = await adminEnv({ failUpdate: true });
  const row = await seedSubmission(env, { id: makeId("I") });
  const response = await callReview(env, row.id, "rejected");
  assert.equal(response.status, 503);
  assert.equal(row.status, "pending");
  assert.equal([...env.objects.keys()].filter(key => key.startsWith("reviewed/")).length, 0);
});

test("preserves the reviewed image if D1 commits before its response fails", async () => {
  const env = await adminEnv({ failUpdateAfterCommit: true });
  const row = await seedSubmission(env, { id: makeId("L") });
  const response = await callReview(env, row.id, "approved");
  assert.equal(response.status, 200);
  assert.equal(row.status, "approved");
  assert.equal(env.objects.has(row.object_key), true);
});

test("leaves no losing photo copy after concurrent conflicting decisions", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("J") });
  const responses = await Promise.all([
    callReview(env, row.id, "approved"),
    callReview(env, row.id, "rejected")
  ]);
  const statuses = responses.map(response => response.status).sort();
  assert.deepEqual(statuses, [200, 409]);
  assert.ok(["approved", "rejected"].includes(row.status));
  assert.equal([...env.objects.keys()].filter(key => key.startsWith("reviewed/")).length, 1);
  assert.equal(env.objects.has(row.object_key), true);
});

test("does not change the decision if copying the image into reviewed retention fails", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("K") });
  env.failures.put = true;
  const response = await callReview(env, row.id, "approved");
  assert.equal(response.status, 503);
  assert.equal(row.status, "pending");
});

test("provides an accessible review queue, image dialog, and explicit decision controls", async () => {
  const html = await readFile(new URL("../public/admin/review.html", import.meta.url), "utf8");
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<dialog\b/);
  assert.match(html, /\/api\/admin\/applications\/image\?id=/);
  assert.match(html, /\/api\/admin\/applications\/review/);
  assert.match(html, /승인/);
  assert.match(html, /반려/);
  assert.match(html, /더 불러오기/);
});

test("links the protected content editor to photo review", async () => {
  const html = await readFile(new URL("../public/admin/index.html", import.meta.url), "utf8");
  assert.match(html, /review\.html/);
});
