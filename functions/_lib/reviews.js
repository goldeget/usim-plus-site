import { jsonResponse } from "./http.js";

export const REVIEW_CAP = 10_000;
export const REVIEW_BODY_MIN = 40;
export const REVIEW_BODY_MAX = 2000;

const textEncoder = new TextEncoder();

export function sha256Hex(value) {
  return crypto.subtle.digest("SHA-256", textEncoder.encode(value)).then(buffer =>
    [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("")
  );
}

export function normalizeReviewBody(body) {
  let text = String(body ?? "").normalize("NFC");
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

export function normalizeForDedup(body) {
  return normalizeReviewBody(body)
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeSnippet(body, maxLen = 110) {
  const normalized = normalizeReviewBody(body).replace(/\n+/g, " ");
  if (normalized.length <= maxLen) return normalized;
  const slice = normalized.slice(0, maxLen);
  const breakAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("."));
  if (breakAt > 40) return `${slice.slice(0, breakAt).trim()}…`;
  return `${slice.trim()}…`;
}

export async function reviewHashes(body) {
  const normalized = normalizeReviewBody(body);
  const norm = normalizeForDedup(body);
  const snippet = makeSnippet(normalized);
  return {
    body_sha256: await sha256Hex(normalized),
    body_norm_sha256: await sha256Hex(norm),
    snippet_sha256: await sha256Hex(snippet),
    snippet,
    body_byte_length: textEncoder.encode(normalized).byteLength
  };
}

export function validateRating(rating) {
  const n = Number(rating);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export function encodeCursor(publishedAt, id) {
  return btoa(JSON.stringify({ p: publishedAt, i: id })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const pad = cursor.length % 4 === 0 ? "" : "=".repeat(4 - (cursor.length % 4));
    const json = atob(cursor.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const parsed = JSON.parse(json);
    if (!parsed?.p || !parsed?.i) return null;
    return { publishedAt: String(parsed.p), id: String(parsed.i) };
  } catch {
    return null;
  }
}

export function publicJson(data, status = 200, maxAge = 60) {
  return jsonResponse(data, status, {
    "Cache-Control": `public, max-age=0, s-maxage=${maxAge}`
  });
}

export async function rebuildReviewStats(db) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(rating) AS rating_sum,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS r1,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS r2,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS r3,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS r4,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS r5
     FROM reviews WHERE status = 'published'`
  ).first();
  const total = Number(row?.total || 0);
  const ratingSum = Number(row?.rating_sum || 0);
  const histogram = {
    "1": Number(row?.r1 || 0),
    "2": Number(row?.r2 || 0),
    "3": Number(row?.r3 || 0),
    "4": Number(row?.r4 || 0),
    "5": Number(row?.r5 || 0)
  };
  const avg = total > 0 ? Math.round((ratingSum / total) * 10) / 10 : 0;
  const updatedAt = new Date().toISOString();
  await db.prepare(
    `INSERT INTO review_stats (id, total_published, avg_rating, histogram_json, rating_sum, updated_at)
     VALUES ('global', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       total_published = excluded.total_published,
       avg_rating = excluded.avg_rating,
       histogram_json = excluded.histogram_json,
       rating_sum = excluded.rating_sum,
       updated_at = excluded.updated_at`
  ).bind(total, avg, JSON.stringify(histogram), ratingSum, updatedAt).run();
  return { total, avgRating: avg, histogram };
}

export function mapReviewRow(row, includeBody = false) {
  if (!row) return null;
  const item = {
    id: row.id,
    publishedAt: row.published_at,
    rating: row.rating,
    snippet: row.snippet,
    displayName: row.display_name,
    tags: JSON.parse(row.tags_json || "{}"),
    featured: Boolean(row.featured)
  };
  if (includeBody) item.body = row._body;
  return item;
}

export async function insertReviewRecord({ db, bucket, record }) {
  const body = normalizeReviewBody(record.body);
  if (body.length < REVIEW_BODY_MIN || body.length > REVIEW_BODY_MAX) {
    return { ok: false, reason: "invalid_length" };
  }
  const rating = validateRating(record.rating);
  if (!rating) return { ok: false, reason: "invalid_rating" };

  const hashes = await reviewHashes(body);
  const id = record.id || crypto.randomUUID().replace(/-/g, "").slice(0, 26);
  const now = new Date().toISOString();
  const publishedAt = record.publishedAt || now;
  const r2Key = `reviews/bodies/${id}.json`;
  const payload = JSON.stringify({ id, body, rating, publishedAt, importedAt: now });

  try {
    await bucket.put(r2Key, payload, {
      httpMetadata: { contentType: "application/json; charset=utf-8" }
    });
    await db.prepare(
      `INSERT INTO reviews (
        id, published_at, rating, snippet, snippet_sha256, body_sha256, body_norm_sha256,
        body_r2_key, body_byte_length, display_name, tags_json, source, source_row_id,
        status, featured, sort_boost, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      publishedAt,
      rating,
      hashes.snippet,
      hashes.snippet_sha256,
      hashes.body_sha256,
      hashes.body_norm_sha256,
      r2Key,
      hashes.body_byte_length,
      String(record.displayName || "참여자").slice(0, 40),
      JSON.stringify(record.tags || {}),
      record.source || "import",
      record.sourceRowId || null,
      record.status || "published",
      record.featured ? 1 : 0,
      Number(record.sortBoost) || 0,
      now,
      now
    ).run();
    return { ok: true, id };
  } catch (error) {
    const message = String(error?.message || error);
    if (/UNIQUE constraint failed/i.test(message)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

export async function fetchReviewBody(bucket, r2Key) {
  const object = await bucket.get(r2Key);
  if (!object) return null;
  const data = JSON.parse(await new Response(object.body).text());
  return typeof data.body === "string" ? data.body : null;
}
