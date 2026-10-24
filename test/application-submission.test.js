import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare, createSubmissionForm, withTurnstileResult } from "../test-support/cloudflare.js";

const secret = "test-turnstile-secret";
const siteKey = "test-turnstile-site-key";
const successfulChallenge = { success: true, hostname: "climekr.com", action: "submit" };
const validEnv = () => ({ ...createMemoryCloudflare(), TURNSTILE_SECRET_KEY: secret, TURNSTILE_SITE_KEY: siteKey, ADMIN_AUTH_SECRET: "application-review-signal-secret-value-32-bytes-minimum" });

async function callUpload(env, options = {}) {
  const { onRequest } = await import("../functions/api/applications.js");
  const request = new Request(options.url || "https://climekr.com/api/applications", {
    method: "POST",
    body: createSubmissionForm(options),
    headers: options.headers
  });
  return onRequest({ request, env });
}

test("stores an allowed photo privately and returns one-time receipt credentials", async () => {
  const env = validEnv();
  const response = await withTurnstileResult(successfulChallenge, () => callUpload(env, { headers: { "cf-connecting-ip": "203.0.113.42" } }));
  assert.equal(response.status, 201);
  const receipt = await response.json();
  assert.match(receipt.id, /^UP-[A-Za-z0-9_-]+$/);
  assert.match(receipt.token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(receipt.createdAt);
  assert.equal(env.rows.size, 1);
  assert.equal(env.objects.size, 1);
  const row = [...env.rows.values()][0];
  assert.equal(row.status, "pending");
  assert.notEqual(row.token_hash, receipt.token);
  assert.match(row.source_ip_hash, /^[a-f0-9]{64}$/);
  assert.match(row.image_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(row.source_ip_hash, "203.0.113.42");
  assert.equal("filename" in row, false);
  assert.equal("private-original-name.jpg".includes(row.object_key), false);
  assert.match(row.object_key, /^pending\//);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("creates domain-separated keyed IP signals and exact image hashes", async () => {
  const { hmacSubmissionSignal, sha256Image } = await import("../functions/_lib/applications.js");
  const key = "application-review-signal-secret-value-32-bytes-minimum";
  const ip = "203.0.113.42";
  const first = await hmacSubmissionSignal(key, "source-ip", ip);
  assert.equal(first, await hmacSubmissionSignal(key, "source-ip", ip));
  assert.notEqual(first, await hmacSubmissionSignal(key, "login-ip", ip));
  assert.notEqual(first, await hmacSubmissionSignal("a-different-secret-value-long-enough-for-hmac", "source-ip", ip));
  assert.equal(await sha256Image(Uint8Array.from([1, 2, 3])), "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
});

test("does not fingerprint an unavailable source IP", async () => {
  const env = validEnv();
  const response = await withTurnstileResult(successfulChallenge, () => callUpload(env));
  assert.equal(response.status, 201);
  assert.equal([...env.rows.values()][0].source_ip_hash, null);
});

test("rejects missing consent without contacting Turnstile or storing a photo", async () => {
  const env = validEnv();
  let contacted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { contacted = true; return new Response("{}", { status: 200 }); };
  try {
    const response = await callUpload(env, { consent: "" });
    assert.equal(response.status, 400);
    assert.equal(env.rows.size, 0);
    assert.equal(env.objects.size, 0);
    assert.equal(contacted, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("rejects a failed, wrong-host, or wrong-action Turnstile challenge", async () => {
  for (const result of [
    { success: false },
    { ...successfulChallenge, hostname: "attacker.example" },
    { ...successfulChallenge, action: "other" }
  ]) {
    const env = validEnv();
    const response = await withTurnstileResult(result, () => callUpload(env));
    assert.equal(response.status, 403);
    assert.equal(env.rows.size, 0);
    assert.equal(env.objects.size, 0);
  }
});

test("allows an exact loopback origin for local Pages testing", async () => {
  const env = validEnv();
  const response = await withTurnstileResult({ success: true, hostname: "127.0.0.1", action: "submit" }, () => callUpload(env, {
    url: "http://127.0.0.1:8788/api/applications",
    headers: { origin: "http://127.0.0.1:8788" }
  }));
  assert.equal(response.status, 201);
  assert.equal(env.rows.size, 1);
});

test("rejects a missing Turnstile challenge", async () => {
  const env = validEnv();
  const response = await callUpload(env, { turnstile: "" });
  assert.equal(response.status, 400);
  assert.equal(env.rows.size, 0);
});

test("rejects invalid image signatures and images larger than 10 MiB", async () => {
  const malformedEnv = validEnv();
  const malformed = await withTurnstileResult(successfulChallenge, () => callUpload(malformedEnv, { bytes: [1, 2, 3] }));
  assert.equal(malformed.status, 400);
  assert.equal(malformedEnv.rows.size, 0);
  const oversizedEnv = validEnv();
  const oversized = await withTurnstileResult(successfulChallenge, () => callUpload(oversizedEnv, { bytes: new Uint8Array(10 * 1024 * 1024 + 1) }));
  assert.equal(oversized.status, 413);
  assert.equal(oversizedEnv.rows.size, 0);
});

test("reports missing production bindings without accepting the file", async () => {
  const env = { TURNSTILE_SECRET_KEY: secret, TURNSTILE_SITE_KEY: siteKey };
  const response = await withTurnstileResult(successfulChallenge, () => callUpload(env));
  assert.equal(response.status, 503);
});

test("removes the uploaded object if D1 cannot persist the receipt", async () => {
  const env = { ...createMemoryCloudflare({ failInsert: true }), TURNSTILE_SECRET_KEY: secret, TURNSTILE_SITE_KEY: siteKey };
  const response = await withTurnstileResult(successfulChallenge, () => callUpload(env));
  assert.equal(response.status, 503);
  assert.equal(env.rows.size, 0);
  assert.equal(env.objects.size, 0);
});

test("rejects an oversized multipart request before parsing or storing it", async () => {
  const env = validEnv();
  let contacted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { contacted = true; return new Response("{}", { status: 200 }); };
  try {
    const response = await callUpload(env, { headers: { "content-length": String(11 * 1024 * 1024) } });
    assert.equal(response.status, 413);
    assert.equal(contacted, false);
    assert.equal(env.rows.size, 0);
    assert.equal(env.objects.size, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("bounds the streamed upload body when Content-Length is missing", async () => {
  const env = validEnv();
  const { onRequest } = await import("../functions/api/applications.js");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(10 * 1024 * 1024 + 64 * 1024 + 1));
      controller.close();
    }
  });
  const request = new Request("https://climekr.com/api/applications", {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=bounded" },
    body: stream,
    duplex: "half"
  });
  const response = await onRequest({ request, env });
  assert.equal(response.status, 413);
  assert.equal(env.rows.size, 0);
  assert.equal(env.objects.size, 0);
});

test("returns a generic not-found response for an incorrect receipt token", async () => {
  const env = validEnv();
  const accepted = await withTurnstileResult(successfulChallenge, () => callUpload(env));
  const receipt = await accepted.json();
  const { onRequest } = await import("../functions/api/applications/status.js");
  const response = await onRequest({
    request: new Request("https://climekr.com/api/applications/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: receipt.id, token: "A".repeat(43) }) }),
    env
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "접수 내역을 찾을 수 없습니다." });
});

test("returns only receipt status and timestamps to the correct token holder", async () => {
  const env = validEnv();
  const accepted = await withTurnstileResult(successfulChallenge, () => callUpload(env));
  const receipt = await accepted.json();
  const { onRequest } = await import("../functions/api/applications/status.js");
  const response = await onRequest({
    request: new Request("https://climekr.com/api/applications/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receipt) }),
    env
  });
  const status = await response.json();
  assert.equal(response.status, 200);
  assert.equal(status.status, "pending");
  assert.ok(status.createdAt);
  assert.equal("token" in status, false);
  assert.equal("object_key" in status, false);
  assert.equal("photo" in status, false);
});

test("reports expired pending applications after 30 days", async () => {
  const env = validEnv();
  const { hashReceiptToken } = await import("../functions/_lib/applications.js");
  const token = "B".repeat(43);
  const id = `UP-${"A".repeat(22)}`;
  env.rows.set(id, { id, token_hash: await hashReceiptToken(token), object_key: "pending/expired.jpg", status: "pending", created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(), reviewed_at: null });
  const { onRequest } = await import("../functions/api/applications/status.js");
  const response = await onRequest({ request: new Request("https://climekr.com/api/applications/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, token }) }), env });
  assert.equal((await response.json()).status, "expired");
});

test("returns a private service error if D1 cannot resolve a receipt", async () => {
  const env = { ...createMemoryCloudflare({ failRead: true }) };
  const { onRequest } = await import("../functions/api/applications/status.js");
  const response = await onRequest({
    request: new Request("https://climekr.com/api/applications/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: `UP-${"A".repeat(22)}`, token: "B".repeat(43) }) }),
    env
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("bounds the receipt lookup body stream when Content-Length is missing", async () => {
  const env = { ...createMemoryCloudflare({ failRead: true }) };
  const { onRequest } = await import("../functions/api/applications/status.js");
  let cancelled = false;
  let closeTimer;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(2049));
      closeTimer = setTimeout(() => controller.close(), 50);
    },
    cancel() { cancelled = true; clearTimeout(closeTimer); }
  });
  const request = new Request("https://climekr.com/api/applications/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stream,
    duplex: "half"
  });
  const response = await onRequest({ request, env });
  assert.equal(request.headers.has("content-length"), false);
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
});

test("exposes the configured public Turnstile site key but never its secret", async () => {
  const env = { TURNSTILE_SITE_KEY: siteKey, TURNSTILE_SECRET_KEY: secret };
  const { onRequest } = await import("../functions/api/applications/config.js");
  const response = await onRequest({ request: new Request("https://climekr.com/api/applications/config"), env });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.siteKey, siteKey);
  assert.equal(JSON.stringify(data).includes(secret), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("fails closed when Turnstile keys are not configured", async () => {
  const { onRequest } = await import("../functions/api/applications/config.js");
  const response = await onRequest({ request: new Request("https://climekr.com/api/applications/config"), env: {} });
  assert.equal(response.status, 503);
});
