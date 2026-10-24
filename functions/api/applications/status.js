import { constantTimeEqual, hashReceiptToken, isExpiredPending, jsonResponse, readBoundedRequestBody } from "../../_lib/applications.js";

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.CONTENT_DB) return jsonResponse({ error: "접수 조회 설정이 완료되지 않았습니다." }, 503);

  let body;
  try {
    const boundedBody = await readBoundedRequestBody(request, 2048);
    if (boundedBody.tooLarge) return jsonResponse({ error: "요청 크기가 너무 큽니다." }, 413);
    const raw = new TextDecoder().decode(boundedBody.bytes);
    body = JSON.parse(raw);
  } catch { return jsonResponse({ error: "접수번호와 조회 토큰을 입력해 주세요." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !/^UP-[A-Za-z0-9_-]{22}$/.test(body.id || "") || !/^[A-Za-z0-9_-]{43}$/.test(body.token || "")) {
    return jsonResponse({ error: "접수번호 또는 조회 토큰을 확인해 주세요." }, 400);
  }

  let row;
  try {
    row = await env.CONTENT_DB.prepare(
      "SELECT id, token_hash, status, created_at, reviewed_at FROM application_submissions WHERE id = ?"
    ).bind(body.id).first();
  } catch { return jsonResponse({ error: "접수 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503); }
  if (!row || !constantTimeEqual(row.token_hash, await hashReceiptToken(body.token))) return jsonResponse({ error: "접수 내역을 찾을 수 없습니다." }, 404);

  const status = row.status === "pending" && isExpiredPending(row.created_at) ? "expired" : row.status;
  return jsonResponse({ status, createdAt: row.created_at, reviewedAt: row.reviewed_at || null });
}
