import {
  MAX_IMAGE_BYTES,
  generateReceiptToken,
  generateReferenceId,
  hmacSubmissionSignal,
  hashReceiptToken,
  jsonResponse,
  readBoundedRequestBody,
  sha256Image,
  validateImage,
  verifyTurnstile
} from "../_lib/applications.js";

const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

function validPublicOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const hostname = requestUrl.hostname.toLowerCase();
    const publicOrigin = originUrl.protocol === "https:" && originUrl.host === requestUrl.host && ["climekr.com", "www.climekr.com"].includes(hostname);
    const localOrigin = ["localhost", "127.0.0.1"].includes(hostname) && originUrl.host === requestUrl.host && originUrl.hostname.toLowerCase() === hostname && ["http:", "https:"].includes(originUrl.protocol);
    return publicOrigin || localOrigin;
  } catch { return false; }
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!validPublicOrigin(request)) return jsonResponse({ error: "요청 출처를 확인할 수 없습니다." }, 403);
  if (!env.CONTENT_DB || !env.APPLICATIONS_BUCKET || !env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY || new TextEncoder().encode(String(env.ADMIN_AUTH_SECRET || "")).byteLength < 32) {
    return jsonResponse({ error: "신청 접수 설정이 완료되지 않았습니다. 운영자에게 문의해 주세요." }, 503);
  }

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > MAX_MULTIPART_BYTES)) {
    return jsonResponse({ error: "사진은 10MB 이하로 첨부해 주세요." }, 413);
  }

  let form;
  try {
    const boundedBody = await readBoundedRequestBody(request, MAX_MULTIPART_BYTES);
    if (boundedBody.tooLarge) return jsonResponse({ error: "사진은 10MB 이하로 첨부해 주세요." }, 413);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    const boundedRequest = new Request(request.url, { method: "POST", headers, body: boundedBody.bytes });
    form = await boundedRequest.formData();
  } catch { return jsonResponse({ error: "사진 신청 요청을 읽을 수 없습니다." }, 400); }

  if (form.get("privacyConsent") !== "on") return jsonResponse({ error: "개인정보 수집·이용에 동의해 주세요." }, 400);
  const challenge = form.get("cf-turnstile-response");
  if (typeof challenge !== "string" || challenge.length < 1 || challenge.length > 2048) return jsonResponse({ error: "자동 접수 방지 확인을 완료해 주세요." }, 400);
  if (!await verifyTurnstile(challenge, env.TURNSTILE_SECRET_KEY, new URL(request.url).hostname)) return jsonResponse({ error: "자동 접수 방지 확인에 실패했습니다. 다시 시도해 주세요." }, 403);

  const file = form.get("statusImage");
  if (!file || typeof file.arrayBuffer !== "function" || !Number.isSafeInteger(file.size)) return jsonResponse({ error: "개통 현황 JPG 또는 PNG 사진을 첨부해 주세요." }, 400);
  if (file.size > MAX_IMAGE_BYTES) return jsonResponse({ error: "사진은 10MB 이하로 첨부해 주세요." }, 413);
  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); }
  catch { return jsonResponse({ error: "사진 파일을 읽을 수 없습니다." }, 400); }
  const imageIssue = validateImage({ contentType: file.type, bytes, size: file.size });
  if (imageIssue) return jsonResponse({ error: imageIssue }, 400);

  const id = generateReferenceId();
  const token = generateReceiptToken();
  const objectKey = `pending/${id.slice(3)}.${file.type === "image/png" ? "png" : "jpg"}`;
  const createdAt = new Date().toISOString();
  const tokenHash = await hashReceiptToken(token);
  const sourceAddress = String(request.headers.get("cf-connecting-ip") || "").trim();
  const sourceIpHash = sourceAddress && sourceAddress.length <= 45
    ? await hmacSubmissionSignal(env.ADMIN_AUTH_SECRET, "source-ip", sourceAddress)
    : null;
  const imageHash = await sha256Image(bytes);
  try {
    await env.APPLICATIONS_BUCKET.put(objectKey, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: { submissionId: id }
    });
  } catch {
    return jsonResponse({ error: "사진을 안전하게 접수하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
  }

  try {
    const result = await env.CONTENT_DB.prepare(
      "INSERT INTO application_submissions (id, token_hash, object_key, content_type, size_bytes, source_ip_hash, image_hash, status, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL)"
    ).bind(id, tokenHash, objectKey, file.type, file.size, sourceIpHash, imageHash, createdAt).run();
    if (result?.meta?.changes !== 1) throw new Error("application insert failed");
  } catch {
    try { await env.APPLICATIONS_BUCKET.delete(objectKey); } catch {}
    return jsonResponse({ error: "신청 내용을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
  }

  return jsonResponse({ id, token, createdAt }, 201);
}
