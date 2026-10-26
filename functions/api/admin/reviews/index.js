import { isAdminRequest, jsonResponse } from "../../../_lib/applications.js";
import {
  REVIEW_CAP,
  decodeCursor,
  encodeCursor,
  insertReviewRecord,
  upsertCorpusReviewRecord,
  mapReviewRow,
  rebuildReviewStats
} from "../../../_lib/reviews.js";
import { loadReviewMeta, queryPublishedReviews } from "../../../_lib/review-static.js";
import { readBoundedRequestBody } from "../../../_lib/http.js";

const BATCH_MAX = 50;

/**
 * D1 무료 티어 일일 쓰기 한도로 reviews 테이블이 비어 있는 동안(재시드 전 임시)
 * 어드민 목록을 정적 코퍼스(public/reviews/data/**)에서 읽어 동일 형태로 반환한다.
 */
async function staticCorpusListResponse(env, request, { limit, status, rating, cursor }) {
  if (status !== "published") {
    return jsonResponse({ items: [], nextCursor: null, totalPublished: 0 });
  }
  const ratingFilter = rating && /^[1-5]$/.test(rating) ? Number(rating) : null;
  const [page, meta] = await Promise.all([
    queryPublishedReviews(env, request, { limit, cursor, rating: ratingFilter, today: new Date() }),
    loadReviewMeta(env, request)
  ]);
  return jsonResponse({
    items: page.items.map(item => ({ ...item, status: "published", source: "corpus_v1" })),
    nextCursor: page.nextCursor,
    totalPublished: Number(meta.count || 0)
  });
}

export async function onRequest({ request, env }) {
  if (!(await isAdminRequest(request, env, { requireOrigin: request.method !== "GET" }))) {
    return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  }
  if (!env.CONTENT_DB || !env.APPLICATIONS_BUCKET) {
    return jsonResponse({ error: "후기 저장소가 연결되지 않았습니다." }, 503);
  }

  if (request.method === "GET") {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 100);
    const status = url.searchParams.get("status") || "published";
    const rating = url.searchParams.get("rating");
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    const filters = ["1=1"];
    const binds = [];
    if (["draft", "published", "hidden"].includes(status)) {
      filters.push("status = ?");
      binds.push(status);
    }
    if (rating && /^[1-5]$/.test(rating)) {
      filters.push("rating = ?");
      binds.push(Number(rating));
    }
    if (cursor) {
      filters.push("(published_at < ? OR (published_at = ? AND id < ?))");
      binds.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
    }
    try {
      const { results } = await env.CONTENT_DB.prepare(
        `SELECT id, published_at, rating, snippet, display_name, tags_json, featured, sort_boost, status, source, source_row_id
         FROM reviews WHERE ${filters.join(" AND ")}
         ORDER BY published_at DESC, id DESC LIMIT ?`
      ).bind(...binds, limit + 1).all();
      if (results.length) {
        const hasMore = results.length > limit;
        const page = hasMore ? results.slice(0, limit) : results;
        const last = page.at(-1);
        const stats = await env.CONTENT_DB.prepare(
          "SELECT total_published FROM review_stats WHERE id = 'global'"
        ).first();
        return jsonResponse({
          items: page.map(r => ({ ...mapReviewRow(r), status: r.status, source: r.source })),
          nextCursor: hasMore && last ? encodeCursor(last.published_at, last.id) : null,
          totalPublished: Number(stats?.total_published || 0)
        });
      }
    } catch {
      // D1 읽기 실패 시에도 아래 정적 코퍼스 폴백으로 응답한다.
    }
    // D1이 비어 있거나(0건) 읽기에 실패한 경우에만 여기로 온다.
    try {
      return await staticCorpusListResponse(env, request, { limit, status, rating, cursor });
    } catch {
      return jsonResponse({ error: "후기 목록을 불러오지 못했습니다." }, 503);
    }
  }

  if (request.method === "POST") {
    const { bytes, tooLarge } = await readBoundedRequestBody(request, 512_000);
    if (tooLarge) return jsonResponse({ error: "요청 크기가 너무 큽니다." }, 413);
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return jsonResponse({ error: "JSON 형식이 올바르지 않습니다." }, 400);
    }
    const rows = Array.isArray(payload.reviews) ? payload.reviews : [];
    if (!rows.length || rows.length > BATCH_MAX) {
      return jsonResponse({ error: `한 번에 1~${BATCH_MAX}건까지 등록할 수 있습니다.` }, 400);
    }

    const current = await env.CONTENT_DB.prepare(
      "SELECT COUNT(*) AS c FROM reviews WHERE status = 'published'"
    ).first();
    let published = Number(current?.c || 0);
    const result = { ok: 0, duplicate: 0, invalid: 0, capped: 0, updated: 0, ids: [] };
    const importSource = payload.source || "admin_import";
    const useCorpusUpsert = importSource === "corpus_v1";

    for (const row of rows) {
      if (published >= REVIEW_CAP) {
        result.capped += 1;
        continue;
      }
      const record = {
        body: row.body,
        rating: row.rating,
        displayName: row.displayName,
        publishedAt: row.publishedAt,
        tags: row.tags,
        source: row.source || importSource,
        sourceRowId: row.rowId || row.sourceRowId,
        featured: row.featured,
        sortBoost: row.sortBoost,
        status: row.status || "published"
      };
      const insert = useCorpusUpsert
        ? await upsertCorpusReviewRecord({
            db: env.CONTENT_DB,
            bucket: env.APPLICATIONS_BUCKET,
            record
          })
        : await insertReviewRecord({
            db: env.CONTENT_DB,
            bucket: env.APPLICATIONS_BUCKET,
            record
          });
      if (insert.ok) {
        if (insert.updated) result.updated += 1;
        else result.ok += 1;
        result.ids.push(insert.id);
        if ((row.status || "published") === "published" && !insert.updated) published += 1;
      } else if (insert.reason === "duplicate") result.duplicate += 1;
      else result.invalid += 1;
    }

    if (result.ok || result.updated) await rebuildReviewStats(env.CONTENT_DB);
    return jsonResponse(result, result.ok ? 201 : 200);
  }

  return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
}
