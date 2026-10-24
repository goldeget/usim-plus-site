import { isAdminRequest, jsonResponse, isExpiredPending, privateImageHeaders } from "../../../_lib/applications.js";

const ID_PATTERN = /^UP-[A-Za-z0-9_-]{22}$/;

export async function onRequest({ request, env }) {
  if (!(await isAdminRequest(request, env))) return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  if (request.method !== "GET") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.CONTENT_DB || !env.APPLICATIONS_BUCKET) return jsonResponse({ error: "사진 저장소가 연결되지 않았습니다." }, 503);

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID_PATTERN.test(id)) return jsonResponse({ error: "접수번호를 확인할 수 없습니다." }, 400);
  let row;
  try {
    row = await env.CONTENT_DB.prepare("SELECT id, object_key, content_type, status, created_at, reviewed_at FROM application_submissions WHERE id = ?").bind(id).first();
  } catch { return jsonResponse({ error: "사진 정보를 불러오지 못했습니다." }, 503); }
  if (!row) return jsonResponse({ error: "사진을 찾을 수 없습니다." }, 404);
  if (row.status === "pending" && isExpiredPending(row.created_at)) return jsonResponse({ error: "보관 기간이 지나 사진이 만료되었습니다." }, 410);
  if (!["image/jpeg", "image/png"].includes(row.content_type)) return jsonResponse({ error: "지원하지 않는 사진 형식입니다." }, 415);

  let object;
  try { object = await env.APPLICATIONS_BUCKET.get(row.object_key); }
  catch { return jsonResponse({ error: "사진을 불러오지 못했습니다." }, 503); }
  if (!object) return jsonResponse({ error: "사진이 이미 만료되었거나 삭제되었습니다." }, 410);
  return new Response(object.body, { status: 200, headers: privateImageHeaders(row.content_type) });
}
