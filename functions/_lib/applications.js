export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const PHOTO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function readBoundedRequestBody(request, maxBytes) {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > maxBytes)) {
    return { bytes: null, tooLarge: true };
  }

  const reader = request.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(0), tooLarge: false };

  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      try { await reader.cancel(); } catch {}
      return { bytes: null, tooLarge: true };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, tooLarge: false };
}

const JPEG_START = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function validateImage({ contentType, bytes, size }) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  const normalizedType = String(contentType || "").toLowerCase();
  const actualSize = Number(size);
  if (!Number.isSafeInteger(actualSize) || actualSize < 1 || actualSize !== data.byteLength) return "사진 파일을 읽을 수 없습니다.";
  if (actualSize > MAX_IMAGE_BYTES) return "사진은 10MB 이하로 첨부해 주세요.";
  if (normalizedType === "image/jpeg" && JPEG_START.every((byte, index) => data[index] === byte)) return null;
  if (normalizedType === "image/png" && PNG_SIGNATURE.every((byte, index) => data[index] === byte)) return null;
  return "JPG 또는 PNG 사진만 첨부할 수 있습니다.";
}

function randomBase64Url(byteCount, cryptoApi) {
  const bytes = new Uint8Array(byteCount);
  cryptoApi.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateReferenceId(cryptoApi = crypto) {
  return `UP-${randomBase64Url(16, cryptoApi)}`;
}

export function generateReceiptToken(cryptoApi = crypto) {
  return randomBase64Url(32, cryptoApi);
}

export async function hashReceiptToken(token, cryptoApi = crypto) {
  const bytes = new TextEncoder().encode(String(token));
  const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let mismatch = a.length ^ b.length;
  const count = Math.max(a.length, b.length);
  for (let i = 0; i < count; i += 1) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}

export function isAdminRequest(request, env, { requireOrigin = false } = {}) {
  const url = new URL(request.url);
  const expectedEmail = String(env?.ADMIN_EMAIL || "").trim().toLowerCase();
  const authenticatedEmail = String(request.headers.get("cf-access-authenticated-user-email") || "").trim().toLowerCase();
  const assertion = String(request.headers.get("cf-access-jwt-assertion") || "");
  if (url.hostname.toLowerCase() !== "admin.climekr.com" || url.protocol !== "https:") return false;
  if (!expectedEmail || !authenticatedEmail || authenticatedEmail !== expectedEmail || !assertion) return false;
  if (requireOrigin && request.headers.get("origin") !== "https://admin.climekr.com") return false;
  return true;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function privateImageHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": 'inline; filename="application-image"',
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin"
  };
}

export async function verifyTurnstile(token, secret, expectedHostname, fetchImpl = fetch) {
  if (!token || !secret) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) return false;
    const result = await response.json();
    const hostname = String(expectedHostname || "").toLowerCase();
    const verifiedHostname = String(result?.hostname || "").toLowerCase();
    const allowedHost = ["climekr.com", "www.climekr.com", "localhost", "127.0.0.1"].includes(hostname);
    return allowedHost && result?.success === true && result?.action === "submit" && verifiedHostname === hostname;
  } catch {
    return false;
  }
}

export function isExpiredPending(createdAt, now = Date.now()) {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && now - created >= PHOTO_RETENTION_MS;
}
