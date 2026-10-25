import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { hashReceiptToken } from "../functions/_lib/applications.js";

const secret = "test-turnstile-secret";
const siteKey = "test-turnstile-site-key";
const validEnv = () => createMemoryCloudflare();
async function seedLegacyReceipt(env) {
  const receipt = {id:`UP-${"C".repeat(22)}`,token:"B".repeat(43)};
  env.rows.set(receipt.id,{id:receipt.id,token_hash:await hashReceiptToken(receipt.token),object_key:"pending/legacy.jpg",status:"pending",created_at:new Date().toISOString(),reviewed_at:null});
  return receipt;
}

test("retired uploads reject cached forms without reading photos or writing storage", async () => {
  const { onRequest } = await import("../functions/api/applications.js");
  let accessed = false;
  const env = new Proxy({}, {get(){accessed=true;throw new Error("storage must not be accessed")}});
  const request = new Request("https://climekr.com/api/applications", {method:"POST",body:"old cached form"});
  request.formData = () => { throw new Error("photo must not be read") };
  const response = await onRequest({request,env});
  assert.equal(response.status,410);
  assert.match((await response.json()).consultationUrl, /#contact$/);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal(accessed,false);
});

test("retired submission endpoint does not redirect photo bodies to another service", async () => {
  const { onRequest } = await import("../functions/api/applications.js");
  const response = await onRequest({request:new Request("https://climekr.com/api/applications")});
  assert.equal(response.status,405);
  assert.equal(response.headers.has("location"),false);
});

test("returns a generic not-found response for an incorrect receipt token", async () => {
  const env = validEnv();
  const receipt = await seedLegacyReceipt(env);
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
  const receipt = await seedLegacyReceipt(env);
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
