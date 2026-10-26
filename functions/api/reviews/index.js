import { decodeCursor, encodeCursor, mapReviewRow, publicJson } from "../../_lib/reviews.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return publicJson({ error: "허용되지 않은 요청입니다." }, 405, 0);
  if (!env.CONTENT_DB) return publicJson({ error: "후기 정보를 불러올 수 없습니다." }, 503, 0);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
  const rating = url.searchParams.get("rating");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  const filters = ["status = 'published'"];
  const binds = [];
  if (rating && /^[1-5]$/.test(rating)) {
    filters.push("rating = ?");
    binds.push(Number(rating));
  }
  if (from) {
    filters.push("published_at >= ?");
    binds.push(from);
  }
  if (to) {
    filters.push("published_at <= ?");
    binds.push(to);
  }
  if (cursor) {
    filters.push("(published_at < ? OR (published_at = ? AND id < ?))");
    binds.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
  }

  const sql = `SELECT id, published_at, rating, snippet, display_name, tags_json, featured, sort_boost
    FROM reviews WHERE ${filters.join(" AND ")}
    ORDER BY published_at DESC, id DESC LIMIT ?`;

  try {
    const { results } = await env.CONTENT_DB.prepare(sql).bind(...binds, limit + 1).all();
    const hasMore = results.length > limit;
    const page = hasMore ? results.slice(0, limit) : results;
    const last = page.at(-1);
    return publicJson({
      items: page.map(r => mapReviewRow(r)),
      nextCursor: hasMore && last ? encodeCursor(last.published_at, last.id) : null
    }, 200, 60);
  } catch {
    return publicJson({ error: "후기 목록을 불러오지 못했습니다." }, 503, 0);
  }
}
