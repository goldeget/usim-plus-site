import { constantTimeEqual, jsonResponse, readBoundedRequestBody } from "./http.js";

export const ADMIN_SESSION_COOKIE = "__Host-usim_admin_session";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_LOGIN_ATTEMPT_LIMIT = 10;
const ADMIN_ORIGIN = "https://admin.climekr.com";
const MAX_LOGIN_BODY_BYTES = 4096;
const encoder = new TextEncoder();

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function readSessionToken(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const matches = cookieHeader.split(";").map(part => part.trim()).filter(part => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(ADMIN_SESSION_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")), char => char.charCodeAt(0));
}

async function sha256Hex(value) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function getAuthConfiguration(env) {
  const email = normalizeEmail(env?.ADMIN_EMAIL);
  const password = String(env?.ADMIN_PASSWORD ?? "");
  const authSecret = String(env?.ADMIN_AUTH_SECRET ?? "");
  if (!email || encoder.encode(email).byteLength > 320 || !env?.CONTENT_DB || encoder.encode(password).byteLength < 12 || encoder.encode(password).byteLength > 256 || encoder.encode(authSecret).byteLength < 32) return null;
  return { email, password, authSecret };
}

export function validatedAdminReturnPath(value) {
  const candidate = String(value ?? "");
  if (!candidate || candidate.startsWith("//") || candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) return "/";
  let url;
  try { url = new URL(candidate, ADMIN_ORIGIN); } catch { return "/"; }
  if (url.origin !== ADMIN_ORIGIN || (url.pathname !== "/" && !url.pathname.startsWith("/admin/"))) return "/";
  if (url.pathname === "/admin/login" || url.pathname === "/admin/login.html") return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function getAdminSession(request, env, now = Date.now()) {
  const url = new URL(request.url);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "admin.climekr.com") return null;
  const config = getAuthConfiguration(env);
  const token = readSessionToken(request);
  if (!config || !token) return null;

  try {
    const tokenHash = await sha256Hex(token);
    const row = await env.CONTENT_DB.prepare(
      "SELECT token_hash, password_version, expires_at FROM admin_sessions WHERE token_hash = ?"
    ).bind(tokenHash).first();
    if (!row) return null;

    const expiry = Date.parse(row.expires_at);
    const currentVersion = await hmacHex(config.authSecret, `account-version\u0000${config.email}\u0000${config.password}`);
    if (!Number.isFinite(expiry) || expiry <= now || !constantTimeEqual(row.password_version, currentVersion)) {
      await env.CONTENT_DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
      return null;
    }
    return { email: config.email };
  } catch {
    return null;
  }
}

export async function isAdminRequest(request, env, { requireOrigin = false } = {}) {
  const url = new URL(request.url);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "admin.climekr.com") return false;
  if (requireOrigin && request.headers.get("origin") !== ADMIN_ORIGIN) return false;
  return Boolean(await getAdminSession(request, env));
}

async function reserveLoginAttempt(env, ipHash, now) {
  const nowIso = new Date(now).toISOString();
  const cutoff = new Date(now - ADMIN_LOGIN_WINDOW_MS).toISOString();
  const row = await env.CONTENT_DB.prepare(
    "INSERT INTO admin_login_attempts (ip_hash, window_started_at, attempts, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(ip_hash) DO UPDATE SET window_started_at = CASE WHEN admin_login_attempts.window_started_at <= ? THEN excluded.window_started_at ELSE admin_login_attempts.window_started_at END, attempts = CASE WHEN admin_login_attempts.window_started_at <= ? THEN 1 ELSE admin_login_attempts.attempts + 1 END, updated_at = excluded.updated_at RETURNING attempts"
  ).bind(ipHash, nowIso, nowIso, cutoff, cutoff).first();
  return Number(row?.attempts || 0);
}

async function readLoginBody(request) {
  const contentType = (request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!['application/json', 'application/x-www-form-urlencoded'].includes(contentType)) return { issue: "요청 형식을 확인해 주세요.", status: 415 };
  const bounded = await readBoundedRequestBody(request, MAX_LOGIN_BODY_BYTES);
  if (bounded.tooLarge) return { issue: "요청 크기가 너무 큽니다.", status: 413 };
  try {
    const raw = new TextDecoder().decode(bounded.bytes);
    const body = contentType === "application/json"
      ? JSON.parse(raw)
      : Object.fromEntries(new URLSearchParams(raw));
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.email !== "string" || typeof body.password !== "string") {
      return { issue: "이메일과 비밀번호를 입력해 주세요.", status: 400 };
    }
    if (encoder.encode(body.email).byteLength > 320 || encoder.encode(body.password).byteLength > 256) {
      return { issue: "이메일 또는 비밀번호 입력을 확인해 주세요.", status: 400 };
    }
    return {
      value: {
        email: body.email,
        password: body.password,
        returnTo: validatedAdminReturnPath(body.returnTo)
      },
      isForm: contentType === "application/x-www-form-urlencoded"
    };
  } catch {
    return { issue: "요청 내용을 확인해 주세요.", status: 400 };
  }
}

function loginRedirect(path, cookie) {
  const headers = new Headers({ "Cache-Control": "no-store", Location: path });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function formErrorResponse(returnTo, error, status, isForm) {
  if (isForm) {
    const query = new URLSearchParams({ error, returnTo });
    return loginRedirect(`/admin/login?${query}`, null);
  }
  return jsonResponse({ error: "로그인할 수 없습니다.", code: error }, status);
}

export async function loginAdminRequest(request, env, now = Date.now()) {
  const url = new URL(request.url);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "admin.climekr.com" || request.headers.get("origin") !== ADMIN_ORIGIN) {
    return jsonResponse({ error: "요청 출처를 확인할 수 없습니다." }, 403);
  }
  if (request.method !== "POST") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  const parsed = await readLoginBody(request);
  if (parsed.issue) return jsonResponse({ error: parsed.issue }, parsed.status);
  const { email, password, returnTo } = parsed.value;
  const config = getAuthConfiguration(env);
  if (!config) return formErrorResponse(returnTo, "setup_required", 503, parsed.isForm);

  try {
    const sourceAddress = request.headers.get("cf-connecting-ip") || "unavailable";
    const ipHash = await hmacHex(config.authSecret, `login-ip\u0000${sourceAddress}`);
    const attemptCount = await reserveLoginAttempt(env, ipHash, now);
    if (attemptCount > ADMIN_LOGIN_ATTEMPT_LIMIT) return formErrorResponse(returnTo, "rate_limited", 429, parsed.isForm);

    const emailMatches = constantTimeEqual(normalizeEmail(email), config.email);
    const passwordMatches = constantTimeEqual(password, config.password);
    if (!(emailMatches && passwordMatches)) return formErrorResponse(returnTo, "credentials", 401, parsed.isForm);

    const random = crypto.getRandomValues(new Uint8Array(32));
    const token = toBase64Url(random);
    const tokenHash = await sha256Hex(token);
    const passwordVersion = await hmacHex(config.authSecret, `account-version\u0000${config.email}\u0000${config.password}`);
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + ADMIN_SESSION_TTL_MS).toISOString();
    await env.CONTENT_DB.prepare(
      "INSERT INTO admin_sessions (token_hash, password_version, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(tokenHash, passwordVersion, createdAt, expiresAt).run();
    try {
      await env.CONTENT_DB.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
    } catch {
      // Session is already stored. Cleanup of the rate-limit row must not fail login.
    }
    const cookie = `${ADMIN_SESSION_COOKIE}=${token}; Path=/; Max-Age=${ADMIN_SESSION_TTL_MS / 1000}; Secure; HttpOnly; SameSite=Strict`;
    if (parsed.isForm) return loginRedirect(returnTo, cookie);
    const response = jsonResponse({ ok: true, redirectTo: returnTo }, 200);
    response.headers.append("Set-Cookie", cookie);
    return response;
  } catch {
    return formErrorResponse(returnTo, "setup_required", 503, parsed.isForm);
  }
}

export async function logoutAdminRequest(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!(await isAdminRequest(request, env, { requireOrigin: true }))) {
    return jsonResponse({ error: "관리자 인증이 필요합니다." }, 401);
  }
  const token = readSessionToken(request);
  try {
    if (token) {
      const tokenHash = await sha256Hex(token);
      await env.CONTENT_DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
    }
  } catch {
    return jsonResponse({ error: "로그아웃하지 못했습니다. 다시 시도해 주세요." }, 503);
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`
    }
  });
}
