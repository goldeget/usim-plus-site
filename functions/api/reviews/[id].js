import { fetchReviewBody, mapReviewRow, publicJson } from "../../_lib/reviews.js";

export async function onRequest({ request, env, params }) {
  if (request.method !== "GET") return publicJson({ error: "허용되지 않은 요청입니다." }, 405, 0);
  if (!env.CONTENT_DB || !env.APPLICATIONS_BUCKET) {
    return publicJson({ error: "후기 정보를 불러올 수 없습니다." }, 503, 0);
  }

  const id = String(params?.id || "").trim();
  if (!id) return publicJson({ error: "후기를 찾을 수 없습니다." }, 404, 0);

  try {
    const row = await env.CONTENT_DB.prepare(
      `SELECT id, published_at, rating, snippet, display_name, tags_json, featured, sort_boost, body_r2_key, status
       FROM reviews WHERE id = ?`
    ).bind(id).first();
    if (!row || row.status !== "published") return publicJson({ error: "후기를 찾을 수 없습니다." }, 404, 0);
    const body = await fetchReviewBody(env.APPLICATIONS_BUCKET, row.body_r2_key);
    if (!body) return publicJson({ error: "후기 본문을 불러오지 못했습니다." }, 503, 0);
    const item = mapReviewRow(row);
    item.body = body;
    return publicJson(item, 200, 300);
  } catch {
    return publicJson({ error: "후기를 불러오지 못했습니다." }, 503, 0);
  }
}
