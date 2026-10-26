import { isAdminRequest, jsonResponse } from "../../../_lib/applications.js";
import { readBoundedRequestBody } from "../../../_lib/http.js";
import { rebuildReviewStats, validateRating } from "../../../_lib/reviews.js";

export async function onRequest({ request, env, params }) {
  if (!(await isAdminRequest(request, env, { requireOrigin: true }))) {
    return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  }
  if (!env.CONTENT_DB) return jsonResponse({ error: "후기 저장소가 연결되지 않았습니다." }, 503);
  if (request.method !== "PATCH") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);

  const id = String(params?.id || "").trim();
  if (!id) return jsonResponse({ error: "후기를 찾을 수 없습니다." }, 404);

  const { bytes, tooLarge } = await readBoundedRequestBody(request, 4096);
  if (tooLarge) return jsonResponse({ error: "요청 크기가 너무 큽니다." }, 413);
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return jsonResponse({ error: "JSON 형식이 올바르지 않습니다." }, 400);
  }

  const updates = [];
  const binds = [];
  if (payload.status && ["draft", "published", "hidden"].includes(payload.status)) {
    updates.push("status = ?");
    binds.push(payload.status);
  }
  if (payload.featured !== undefined) {
    updates.push("featured = ?");
    binds.push(payload.featured ? 1 : 0);
  }
  if (payload.sortBoost !== undefined) {
    updates.push("sort_boost = ?");
    binds.push(Number(payload.sortBoost) || 0);
  }
  if (payload.rating !== undefined) {
    const rating = validateRating(payload.rating);
    if (!rating) return jsonResponse({ error: "별점은 1~5 사이여야 합니다." }, 400);
    updates.push("rating = ?");
    binds.push(rating);
  }
  if (!updates.length) return jsonResponse({ error: "변경할 항목이 없습니다." }, 400);

  updates.push("updated_at = ?");
  binds.push(new Date().toISOString());
  binds.push(id);

  try {
    const outcome = await env.CONTENT_DB.prepare(
      `UPDATE reviews SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...binds).run();
    if (!outcome.meta.changes) return jsonResponse({ error: "후기를 찾을 수 없습니다." }, 404);
    await rebuildReviewStats(env.CONTENT_DB);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "후기를 수정하지 못했습니다." }, 503);
  }
}
