import { publicJson, rebuildReviewStats } from "../../_lib/reviews.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return publicJson({ error: "허용되지 않은 요청입니다." }, 405, 0);
  if (!env.CONTENT_DB) return publicJson({ error: "후기 정보를 불러올 수 없습니다." }, 503, 0);

  try {
    let stats = await env.CONTENT_DB.prepare(
      "SELECT total_published, avg_rating, histogram_json, updated_at FROM review_stats WHERE id = 'global'"
    ).first();
    if (!stats) {
      const rebuilt = await rebuildReviewStats(env.CONTENT_DB);
      stats = {
        total_published: rebuilt.total,
        avg_rating: rebuilt.avgRating,
        histogram_json: JSON.stringify(rebuilt.histogram),
        updated_at: new Date().toISOString()
      };
    }
    return publicJson({
      total: Number(stats.total_published),
      avgRating: Number(stats.avg_rating),
      histogram: JSON.parse(stats.histogram_json || "{}"),
      updatedAt: stats.updated_at
    }, 200, 300);
  } catch {
    return publicJson({ error: "후기 집계를 불러오지 못했습니다." }, 503, 0);
  }
}
