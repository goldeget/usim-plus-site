import assert from "node:assert/strict";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { createAdminEnvironment, createAdminSessionHeaders } from "../test-support/admin-auth.js";

const helpersPath = "../functions/_lib/applications.js";
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x00, 0xff, 0xd9]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("accepts JPEG and PNG signatures with matching media types", async () => {
  const { validateImage } = await import(helpersPath);
  assert.equal(validateImage({ contentType: "image/jpeg", bytes: jpeg, size: jpeg.byteLength }), null);
  assert.equal(validateImage({ contentType: "image/png", bytes: png, size: png.byteLength }), null);
});

test("rejects a forged media type and an unsupported image signature", async () => {
  const { validateImage } = await import(helpersPath);
  assert.ok(validateImage({ contentType: "image/png", bytes: jpeg, size: jpeg.byteLength }));
  assert.ok(validateImage({ contentType: "image/jpeg", bytes: png, size: png.byteLength }));
  assert.ok(validateImage({ contentType: "image/gif", bytes: Uint8Array.from([71, 73, 70]), size: 3 }));
});

test("rejects empty and over-10-MiB images", async () => {
  const { validateImage, MAX_IMAGE_BYTES } = await import(helpersPath);
  assert.ok(validateImage({ contentType: "image/jpeg", bytes: new Uint8Array(), size: 0 }));
  assert.equal(MAX_IMAGE_BYTES, 10 * 1024 * 1024);
  assert.ok(validateImage({ contentType: "image/jpeg", bytes: jpeg, size: MAX_IMAGE_BYTES + 1 }));
});

test("creates opaque URL-safe identifiers and a 256-bit receipt token", async () => {
  const { generateReferenceId, generateReceiptToken } = await import(helpersPath);
  const firstId = generateReferenceId(webcrypto);
  const secondId = generateReferenceId(webcrypto);
  const token = generateReceiptToken(webcrypto);
  assert.match(firstId, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(firstId, secondId);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
});

test("hashes the receipt token without storing its plaintext", async () => {
  const { hashReceiptToken } = await import(helpersPath);
  const first = await hashReceiptToken("receipt-token", webcrypto);
  const second = await hashReceiptToken("receipt-token", webcrypto);
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, await hashReceiptToken("other-token", webcrypto));
});

test("requires a valid session on the exact HTTPS admin host", async () => {
  const { isAdminRequest } = await import(helpersPath);
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  assert.equal(await isAdminRequest(new Request("https://admin.climekr.com/api/admin/applications", { headers }), env), true);
  assert.equal(await isAdminRequest(new Request("https://climekr.com/api/admin/applications", { headers }), env), false);
  assert.equal(await isAdminRequest(new Request("http://admin.climekr.com/api/admin/applications", { headers }), env), false);
  assert.equal(await isAdminRequest(new Request("https://admin.climekr.com/api/admin/applications", { headers: { "cf-access-authenticated-user-email": env.ADMIN_EMAIL, "cf-access-jwt-assertion": "forged" } }), env), false);
  assert.equal(await isAdminRequest(new Request("https://admin.climekr.com/api/admin/applications", { headers }), {}), false);
});

test("requires the admin origin for mutating requests", async () => {
  const { isAdminRequest } = await import(helpersPath);
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const headers = { ...sessionHeaders, origin: "https://evil.example" };
  assert.equal(await isAdminRequest(new Request("https://admin.climekr.com/api/admin/applications/review", { method: "POST", headers }), env, { requireOrigin: true }), false);
  headers.origin = "https://admin.climekr.com";
  assert.equal(await isAdminRequest(new Request("https://admin.climekr.com/api/admin/applications/review", { method: "POST", headers }), env, { requireOrigin: true }), true);
});

test("JSON responses are private, non-cacheable, and nosniff", async () => {
  const { jsonResponse } = await import(helpersPath);
  const response = jsonResponse({ ok: true }, 201);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-type"), /application\/json; charset=utf-8/);
  assert.deepEqual(await response.json(), { ok: true });
});
