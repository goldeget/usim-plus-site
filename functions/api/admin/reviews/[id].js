import { isAdminRequest, jsonResponse } from "../../../_lib/applications.js";
import { readBoundedRequestBody } from "../../../_lib/http.js";
import { fetchReviewBody, mapReviewRow, rebuildReviewStats, validateRating } from "../../../_lib/reviews.js";
import { getPublishedReview } from "../../../_lib/review-static.js";

export async function onRequest({ request, env, params }) {
  if (!(await isAdminRequest(request, env, { requireOrigin: request.method !== "GET" }))) {
    return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  }
  if (!env.CONTENT_DB) return jsonResponse({ error: "후기 저장소가 연결되지 않았습니다." }, 503);

  const id = String(params?.id || "").trim();
  if (!id) return jsonResponse({ error: "후기를 찾을 수 없습니다." }, 404);

  if (request.method === "GET") {
    // D1(+R2 본문)을 먼저 보고, 실패·미존재 시 정적 코퍼스로 폴백한다.
    // (D1 무료 티어 쓰기 한도로 테이블이 비어 있는 동안 재시드 전 임시 일관성 유지)
    try {
      const row = await env.CONTENT_DB.prepare(
        `SELECT id, published_at, rating, snippet, display_name, tags_json, featured, status, source, body_r2_key
         FROM reviews WHERE id = ?`
      ).bind(id).first();
      if (row) {
        const body = await fetchReviewBody(env.APPLICATIONS_BUCKET, row.body_r2_key);
        if (body != null) {
          return jsonResponse({ ...mapReviewRow({ ...row, _body: body }, true), status: row.status, source: row.source });
        }
      }
    } catch {
      // 아래 정적 코퍼스 폴백으로 이어진다.
    }
    try {
      const item = await getPublishedReview(env, request, id, new Date());
      if (!item) return jsonResponse({ error: "후기를 찾을 수 없습니다." }, 404);
      return jsonResponse({ ...item, status: "published", source: "corpus_v1" });
    } catch {
      return jsonResponse({ error: "후기를 불러오지 못했습니다." }, 503);
    }
  }

  if (request.method !== "PATCH") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);

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
