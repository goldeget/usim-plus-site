import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";

test("bounds Access-protected CMS writes when Content-Length is missing", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = { ...createMemoryCloudflare(), ADMIN_EMAIL: "admin@example.test" };
  let cancelled = false;
  let closeTimer;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(36001));
      closeTimer = setTimeout(() => controller.close(), 50);
    },
    cancel() { cancelled = true; clearTimeout(closeTimer); }
  });
  const request = new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "cf-access-authenticated-user-email": "admin@example.test",
      "cf-access-jwt-assertion": "local-test",
      origin: "https://admin.climekr.com"
    },
    body: stream,
    duplex: "half"
  });
  const response = await onRequest({ request, env });
  assert.equal(request.headers.has("content-length"), false);
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
});

test("accepts the existing 12000-character CMS limit with Korean UTF-8 text", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = { ...createMemoryCloudflare(), ADMIN_EMAIL: "admin@example.test" };
  const content = {
    headline: "가".repeat(100),
    intro: "나".repeat(500),
    checklist: Array.from({ length: 6 }, () => ({ title: "다".repeat(80), body: "라".repeat(300) })),
    faqs: Array.from({ length: 10 }, () => ({ question: "마".repeat(160), answer: "바".repeat(400) }))
  };
  const body = JSON.stringify(content);
  assert.ok(body.length <= 12000);
  assert.ok(Buffer.byteLength(body) > 24000);
  const request = new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "cf-access-authenticated-user-email": "admin@example.test",
      "cf-access-jwt-assertion": "local-test",
      origin: "https://admin.climekr.com"
    },
    body
  });
  const response = await onRequest({ request, env });
  assert.equal(response.status, 200);
});
