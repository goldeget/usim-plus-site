export const TEST_ADMIN_EMAIL = "admin@example.test";
export const TEST_ADMIN_PASSWORD = "correct horse battery staple";
export const TEST_ADMIN_AUTH_SECRET = "test-only-session-key-with-at-least-32-bytes";

export function createAdminEnvironment(options = {}) {
  return {
    ...options.cloudflare,
    ADMIN_EMAIL: options.email || TEST_ADMIN_EMAIL,
    ADMIN_PASSWORD: options.password ?? TEST_ADMIN_PASSWORD,
    ADMIN_AUTH_SECRET: options.authSecret ?? TEST_ADMIN_AUTH_SECRET
  };
}

export async function loginAdmin(env, {
  email = env.ADMIN_EMAIL,
  password = env.ADMIN_PASSWORD,
  origin = "https://admin.climekr.com",
  remoteAddress = "192.0.2.30",
  returnTo = "/"
} = {}) {
  const { onRequest } = await import("../functions/api/admin/auth/login.js");
  const response = await onRequest({
    request: new Request("https://admin.climekr.com/api/admin/auth/login", {
      method: "POST",
      headers: {
        origin,
        "cf-connecting-ip": remoteAddress,
        "content-type": "application/json"
      },
      body: JSON.stringify({ email, password, returnTo })
    }),
    env
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  return { response, headers: cookie ? { cookie } : {} };
}

export async function createAdminSessionHeaders(env, options) {
  const result = await loginAdmin(env, options);
  if (result.response.status !== 200 || !result.headers.cookie) {
    throw new Error(`Failed to create test admin session: HTTP ${result.response.status}`);
  }
  return result.headers;
}
