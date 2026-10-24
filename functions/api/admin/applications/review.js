import { isAdminRequest, isExpiredPending, jsonResponse, PHOTO_RETENTION_MS, readBoundedRequestBody } from "../../../_lib/applications.js";

const ID_PATTERN = /^UP-[A-Za-z0-9_-]{22}$/;

async function readReviewRequest(request) {
  try {
    const boundedBody = await readBoundedRequestBody(request, 1024);
    if (boundedBody.tooLarge) return { issue: "요청 크기가 너무 큽니다.", status: 413 };
    const raw = new TextDecoder().decode(boundedBody.bytes);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) || !ID_PATTERN.test(body.id || "") || !["approved", "rejected"].includes(body.decision)) {
      return { issue: "접수번호와 검토 결과를 확인해 주세요.", status: 400 };
    }
    return { value: { id: body.id, decision: body.decision } };
  } catch { return { issue: "JSON 형식의 검토 요청이 필요합니다.", status: 400 }; }
}

async function discardIfUnreferenced(bucket, key, row) {
  if (row?.object_key === key) return;
  try { await bucket.delete(key); } catch {}
}

export async function onRequest({ request, env }) {
  if (!isAdminRequest(request, env, { requireOrigin: true })) return jsonResponse({ error: "관리자 인증 또는 요청 출처를 확인할 수 없습니다." }, 403);
  if (request.method !== "POST") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.CONTENT_DB || !env.APPLICATIONS_BUCKET) return jsonResponse({ error: "신청 저장소가 연결되지 않았습니다." }, 503);
  const parsed = await readReviewRequest(request);
  if (parsed.issue) return jsonResponse({ error: parsed.issue }, parsed.status);
  const { id, decision } = parsed.value;

  let row;
  try {
    row = await env.CONTENT_DB.prepare("SELECT id, object_key, content_type, status, created_at, reviewed_at FROM application_submissions WHERE id = ?").bind(id).first();
  } catch { return jsonResponse({ error: "신청 정보를 불러오지 못했습니다." }, 503); }
  if (!row) return jsonResponse({ error: "신청 내역을 찾을 수 없습니다." }, 404);
  if (row.status !== "pending") return jsonResponse({ error: "이미 검토가 완료된 신청입니다." }, 409);
  if (isExpiredPending(row.created_at)) return jsonResponse({ error: "미검토 보관 기간이 지나 신청이 만료되었습니다." }, 410);

  let original;
  try { original = await env.APPLICATIONS_BUCKET.get(row.object_key); }
  catch { return jsonResponse({ error: "사진을 불러오지 못했습니다." }, 503); }
  if (!original) return jsonResponse({ error: "사진이 이미 만료되었거나 삭제되었습니다." }, 410);

  const extension = row.content_type === "image/png" ? "png" : "jpg";
  const reviewedKey = `reviewed/${id.slice(3)}/${decision}.${extension}`;
  try {
    await env.APPLICATIONS_BUCKET.put(reviewedKey, original.body, {
      httpMetadata: { contentType: row.content_type },
      customMetadata: { submissionId: id, reviewedAt: new Date().toISOString() }
    });
  } catch { return jsonResponse({ error: "검토용 사진 보관을 준비하지 못했습니다." }, 503); }

  const reviewedAt = new Date().toISOString();
  const cutoff = new Date(Date.now() - PHOTO_RETENTION_MS).toISOString();
  let update;
  try {
    update = await env.CONTENT_DB.prepare(
      "UPDATE application_submissions SET status = ?, object_key = ?, reviewed_at = ? WHERE id = ? AND status = 'pending' AND created_at > ?"
    ).bind(decision, reviewedKey, reviewedAt, id, cutoff).run();
  } catch {
    let current;
    try { current = await env.CONTENT_DB.prepare("SELECT id, object_key, status, reviewed_at FROM application_submissions WHERE id = ?").bind(id).first(); }
    catch { return jsonResponse({ error: "검토 결과 저장 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요." }, 503); }
    if (current?.status === decision && current.object_key === reviewedKey) {
      try { await env.APPLICATIONS_BUCKET.delete(row.object_key); } catch {}
      return jsonResponse({ id, status: current.status, reviewedAt: current.reviewed_at });
    }
    await discardIfUnreferenced(env.APPLICATIONS_BUCKET, reviewedKey, current);
    if (current && current.status !== "pending") return jsonResponse({ error: "다른 검토 결과가 먼저 저장되었습니다." }, 409);
    return jsonResponse({ error: "검토 결과를 저장하지 못했습니다." }, 503);
  }

  if (update?.meta?.changes !== 1) {
    let current = null;
    try { current = await env.CONTENT_DB.prepare("SELECT id, object_key, status, reviewed_at FROM application_submissions WHERE id = ?").bind(id).first(); }
    catch {}
    await discardIfUnreferenced(env.APPLICATIONS_BUCKET, reviewedKey, current);
    if (current?.status === decision && current.object_key === reviewedKey) {
      return jsonResponse({ id, status: current.status, reviewedAt: current.reviewed_at });
    }
    return jsonResponse({ error: "다른 검토 결과가 먼저 저장되었거나 신청이 만료되었습니다." }, 409);
  }

  try { await env.APPLICATIONS_BUCKET.delete(row.object_key); } catch {}
  return jsonResponse({ id, status: decision, reviewedAt });
}
