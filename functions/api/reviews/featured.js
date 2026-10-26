import { mapReviewRow, publicJson } from "../../_lib/reviews.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return publicJson({ error: "허용되지 않은 요청입니다." }, 405, 0);
  if (!env.CONTENT_DB) return publicJson({ error: "후기 정보를 불러올 수 없습니다." }, 503, 0);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 8, 1), 20);

  try {
    const { results } = await env.CONTENT_DB.prepare(
      `SELECT id, published_at, rating, snippet, display_name, tags_json, featured, sort_boost
       FROM reviews
       WHERE status = 'published' AND featured = 1
       ORDER BY sort_boost DESC, published_at DESC, id DESC
       LIMIT ?`
    ).bind(limit).all();
    if (results.length < limit) {
      const { results: fill } = await env.CONTENT_DB.prepare(
        `SELECT id, published_at, rating, snippet, display_name, tags_json, featured, sort_boost
         FROM reviews
         WHERE status = 'published'
         ORDER BY published_at DESC, id DESC
         LIMIT ?`
      ).bind(limit).all();
      const seen = new Set(results.map(r => r.id));
      for (const row of fill) {
        if (results.length >= limit) break;
        if (seen.has(row.id)) continue;
        results.push(row);
      }
    }
    return publicJson({ items: results.map(r => mapReviewRow(r)) }, 200, 60);
  } catch {
    return publicJson({ error: "후기를 불러오지 못했습니다." }, 503, 0);
  }
}
