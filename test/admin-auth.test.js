import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { createAdminEnvironment, loginAdmin, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "../test-support/admin-auth.js";

function adminEnv(options = {}) {
  return createAdminEnvironment({ cloudflare: createMemoryCloudflare(), ...options });
}

test("creates a hashed eight-hour session with a secure host-only cookie", async () => {
  const env = adminEnv();
  const { response } = await loginAdmin(env, { returnTo: "/admin/review.html" });
  const cookie = response.headers.get("set-cookie");
  const token = cookie.match(/__Host-usim_admin_session=([^;]+)/)?.[1];
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, redirectTo: "/admin/review.html" });
  assert.match(cookie, /; Path=\//);
  assert.match(cookie, /; Max-Age=28800/);
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; HttpOnly/);
  assert.match(cookie, /; SameSite=Strict/);
  assert.doesNotMatch(cookie, /Domain=/i);
  assert.equal(env.adminSessions.size, 1);
  assert.equal([...env.adminSessions.values()][0].token_hash.includes(token), false);
  assert.equal([...env.adminSessions.values()][0].password_version.length, 64);
  assert.equal(JSON.stringify([...env.adminSessions.values()]).includes(TEST_ADMIN_PASSWORD), false);
});

test("uses the same login error for an unknown email and wrong password", async () => {
  const env = adminEnv();
  const unknownEmail = await loginAdmin(env, { email: "intruder@example.test" });
  const wrongPassword = await loginAdmin(env, { password: "incorrect password" });
  assert.equal(unknownEmail.response.status, 401);
  assert.equal(wrongPassword.response.status, 401);
  assert.deepEqual(await unknownEmail.response.json(), await wrongPassword.response.json());
  assert.equal(unknownEmail.response.headers.has("set-cookie"), false);
});

test("fails closed when the password or independent session key is missing", async () => {
  for (const options of [{ password: "" }, { authSecret: "" }]) {
    const env = adminEnv(options);
    const { response } = await loginAdmin(env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "setup_required");
  }
});

test("rejects credential values longer than the configured maximum without truncating them", async () => {
  const env = adminEnv({ password: "x".repeat(256) });
  const { response } = await loginAdmin(env, { password: `${"x".repeat(256)}y` });
  assert.equal(response.status, 400);
  assert.equal(env.adminSessions.size, 0);
});

test("requires the exact HTTPS admin origin before reading credentials", async () => {
  const env = adminEnv();
  const wrongOrigin = await loginAdmin(env, { origin: "https://evil.example" });
  assert.equal(wrongOrigin.response.status, 403);
  assert.equal(env.adminLoginAttempts.size, 0);
});

test("bounds streamed login requests when Content-Length is missing", async () => {
  const { onRequest } = await import("../functions/api/admin/auth/login.js");
  const env = adminEnv();
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4097)); controller.close(); } });
  const request = new Request("https://admin.climekr.com/api/admin/auth/login", {
    method: "POST",
    headers: { origin: "https://admin.climekr.com", "cf-connecting-ip": "192.0.2.31", "content-type": "application/json" },
    body: stream,
    duplex: "half"
  });
  const response = await onRequest({ request, env });
  assert.equal(response.status, 413);
  assert.equal(env.adminLoginAttempts.size, 0);
});

test("limits an address to ten login attempts per 15-minute window", async () => {
  const env = adminEnv();
  for (let i = 0; i < 10; i += 1) {
    const { response } = await loginAdmin(env, { password: `wrong-${i}` });
    assert.equal(response.status, 401);
  }
  assert.equal((await loginAdmin(env, { password: "another-wrong" })).response.status, 429);
  const saved = [...env.adminLoginAttempts.values()][0];
  assert.equal(saved.ip_hash.length, 64);
  assert.equal(JSON.stringify(saved).includes("192.0.2.30"), false);
});

test("accepts only the configured email and password, and password rotation revokes the session", async () => {
  const { getAdminSession } = await import("../functions/_lib/admin-auth.js");
  const env = adminEnv();
  const { response } = await loginAdmin(env);
  const request = new Request("https://admin.climekr.com/api/admin/applications", { headers: { cookie: response.headers.get("set-cookie").split(";", 1)[0] } });
  assert.equal((await getAdminSession(request, env))?.email, TEST_ADMIN_EMAIL);
  env.ADMIN_PASSWORD = `${TEST_ADMIN_PASSWORD}!rotated`;
  assert.equal(await getAdminSession(request, env), null);
  assert.equal(env.adminSessions.size, 0);
});

test("expires a session at eight hours and rejects other hosts and HTTP", async () => {
  const { getAdminSession } = await import("../functions/_lib/admin-auth.js");
  const env = adminEnv();
  const { response } = await loginAdmin(env);
  const headers = { cookie: response.headers.get("set-cookie").split(";", 1)[0] };
  assert.equal(await getAdminSession(new Request("http://admin.climekr.com/", { headers }), env), null);
  assert.equal(await getAdminSession(new Request("https://climekr.com/", { headers }), env), null);
  assert.equal(await getAdminSession(new Request("https://admin.climekr.com/", { headers }), env, Date.now() + 8 * 60 * 60 * 1000), null);
  assert.equal(env.adminSessions.size, 0);
});

test("logout revokes the D1 session and clears the cookie", async () => {
  const env = adminEnv();
  const loggedIn = await loginAdmin(env);
  const { onRequest } = await import("../functions/api/admin/auth/logout.js");
  const response = await onRequest({
    request: new Request("https://admin.climekr.com/api/admin/auth/logout", {
      method: "POST",
      headers: { origin: "https://admin.climekr.com", cookie: loggedIn.response.headers.get("set-cookie").split(";", 1)[0] }
    }),
    env
  });
  assert.equal(response.status, 204);
  assert.equal(env.adminSessions.size, 0);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});

test("rejects external or malformed post-login return paths", async () => {
  const env = adminEnv();
  const { response } = await loginAdmin(env, { returnTo: "//evil.example/path" });
  assert.equal((await response.json()).redirectTo, "/");
});

test("compares credentials across a fixed byte count", async () => {
  const { constantTimeEqual } = await import("../functions/_lib/http.js");
  assert.equal(constantTimeEqual("관리자", "관리자"), true);
  assert.equal(constantTimeEqual("administrator", "administered"), false);
  assert.equal(constantTimeEqual("x".repeat(513), "x".repeat(513)), false);
});
