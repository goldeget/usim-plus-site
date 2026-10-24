import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { createAdminEnvironment, createAdminSessionHeaders } from "../test-support/admin-auth.js";
import { onRequest } from "../functions/_middleware.js";

function context(url, env, headers = {}, method = "GET") {
  let nextCalls = 0;
  const next = async () => { nextCalls += 1; return new Response("asset"); };
  return {
    value: { request: new Request(url, { method, headers }), env, next },
    get nextCalls() { return nextCalls; }
  };
}

test("serves only the admin login page without a session", async () => {
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  for (const path of ["/admin/login", "/admin/login.html"]) {
    const login = context(`https://admin.climekr.com${path}`, env);
    const response = await onRequest(login.value);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "asset");
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  }

  const loginPost = context("https://admin.climekr.com/api/admin/auth/login", env, { origin: "https://admin.climekr.com" }, "POST");
  assert.equal((await onRequest(loginPost.value)).status, 200);
  assert.equal(loginPost.nextCalls, 1);
});

test("redirects browser pages and returns JSON 401 for APIs without a session", async () => {
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const page = context("https://admin.climekr.com/admin/review.html?from=bookmark", env);
  const pageResponse = await onRequest(page.value);
  assert.equal(pageResponse.status, 302);
  assert.equal(new URL(pageResponse.headers.get("location")).pathname, "/admin/login");
  assert.equal(new URL(pageResponse.headers.get("location")).searchParams.get("returnTo"), "/admin/review.html?from=bookmark");

  const root = context("https://admin.climekr.com/", env);
  assert.equal((await onRequest(root.value)).status, 302);
  const api = context("https://admin.climekr.com/api/admin/applications", env);
  const apiResponse = await onRequest(api.value);
  assert.equal(apiResponse.status, 401);
  assert.deepEqual(await apiResponse.json(), { error: "관리자 로그인이 필요합니다.", code: "unauthenticated" });
});

test("keeps public-host and preview-host admin routes inaccessible", async () => {
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  for (const host of ["climekr.com", "www.climekr.com", "usim-plus-site.pages.dev"]) {
    const page = context(`https://${host}/admin/login.html`, env);
    assert.equal((await onRequest(page.value)).status, 404);
    assert.equal(page.nextCalls, 0);
  }
});

test("redirects the www alias to the canonical host and marks Pages previews noindex", async () => {
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const www = context("http://www.climekr.com/guides/usim?from=search", env);
  const wwwResponse = await onRequest(www.value);
  assert.equal(wwwResponse.status, 308);
  assert.equal(wwwResponse.headers.get("location"), "https://climekr.com/guides/usim?from=search");

  const preview = context("https://usim-plus-site.pages.dev/", env);
  const previewResponse = await onRequest(preview.value);
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("serves the editor and review assets only after a valid session", async () => {
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  let assetPath = "";
  env.ASSETS = { async fetch(request) { assetPath = new URL(request.url).pathname; return new Response("editor"); } };

  const root = context("https://admin.climekr.com/", env, headers);
  const rootResponse = await onRequest(root.value);
  assert.equal(rootResponse.status, 200);
  assert.equal(await rootResponse.text(), "editor");
  assert.equal(assetPath, "/admin/index.html");
  assert.match(rootResponse.headers.get("cache-control"), /no-store/);

  const review = context("https://admin.climekr.com/admin/review.html", env, headers);
  assert.equal((await onRequest(review.value)).status, 200);
  assert.equal(review.nextCalls, 1);
});

test("redirects a session holder away from the login page to an allowed return path", async () => {
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const page = context("https://admin.climekr.com/admin/login?returnTo=https%3A%2F%2Fevil.example", env, headers);
  const response = await onRequest(page.value);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://admin.climekr.com/");
  assert.equal(page.nextCalls, 0);
});
