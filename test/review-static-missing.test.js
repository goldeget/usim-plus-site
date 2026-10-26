import assert from "node:assert/strict";
import { test } from "node:test";

test("public review routes return 503 when static assets are unavailable", async () => {
  const env = { ASSETS: { async fetch() { return new Response("no", { status: 404 }); } } };
  const { onRequest } = await import("../functions/api/reviews/stats.js");
  const response = await onRequest({
    request: new Request("https://climekr.com/api/reviews/stats"),
    env
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /집계/);
});
