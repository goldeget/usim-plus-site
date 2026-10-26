#!/usr/bin/env node
/**
 * Emits a one-shot Worker script (ES module) that seeds 10k reviews into bound D1 + R2.
 * Output: scripts/.one-shot-seed-worker.mjs (gitignored pattern)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const gen = readFileSync(path.join(root, "generate-review-rows.mjs"), "utf8")
  .replace(/^import .*$/gm, "")
  .replace(/export function generateReviewRows/, "function generateReviewRows");

const reviewsLib = readFileSync(path.join(root, "../functions/_lib/reviews.js"), "utf8");
const helpers = reviewsLib
  .match(
    /export const REVIEW_CAP[\s\S]*?export function validateRating[\s\S]*?^}/m
  )?.[0]
  ?.replace(/^export /gm, "")
  ?.replace(/export async function reviewHashes/, "async function reviewHashes");
if (!helpers) throw new Error("Could not extract review helpers from reviews.js");

const worker = `${helpers}

${gen}

async function insertReviewRecord(db, bucket, record) {
  const importIssue = validateReviewImportRecord(record);
  if (importIssue) return { ok: false, reason: importIssue };
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
  const r2Key = \`reviews/bodies/\${id}.json\`;
  const payload = JSON.stringify({ id, body, rating, publishedAt, importedAt: now });
  await bucket.put(r2Key, payload, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  await db.prepare(
    \`INSERT INTO reviews (
      id, published_at, rating, snippet, snippet_sha256, body_sha256, body_norm_sha256,
      body_r2_key, body_byte_length, display_name, tags_json, source, source_row_id,
      status, featured, sort_boost, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
  ).bind(
    id, publishedAt, rating, hashes.snippet, hashes.snippet_sha256, hashes.body_sha256,
    hashes.body_norm_sha256, r2Key, hashes.body_byte_length,
    String(record.displayName || "참여자").slice(0, 40), JSON.stringify(record.tags || {}),
    record.source || "import", record.sourceRowId || null, record.status || "published",
    record.featured ? 1 : 0, Number(record.sortBoost) || 0, now, now
  ).run();
  return { ok: true, id };
}

async function rebuildReviewStats(db) {
  const row = await db.prepare(
    \`SELECT COUNT(*) AS total, SUM(rating) AS rating_sum,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS r1,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS r2,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS r3,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS r4,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS r5
     FROM reviews WHERE status = 'published'\`
  ).first();
  const total = Number(row?.total || 0);
  const ratingSum = Number(row?.rating_sum || 0);
  const histogram = { "1": Number(row?.r1||0), "2": Number(row?.r2||0), "3": Number(row?.r3||0), "4": Number(row?.r4||0), "5": Number(row?.r5||0) };
  const avg = total > 0 ? Math.round((ratingSum / total) * 10) / 10 : 0;
  const updatedAt = new Date().toISOString();
  await db.prepare(
    \`INSERT INTO review_stats (id, total_published, avg_rating, histogram_json, rating_sum, updated_at)
     VALUES ('global', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET total_published=excluded.total_published, avg_rating=excluded.avg_rating,
       histogram_json=excluded.histogram_json, rating_sum=excluded.rating_sum, updated_at=excluded.updated_at\`
  ).bind(total, avg, JSON.stringify(histogram), ratingSum, updatedAt).run();
  return { total, avgRating: avg, histogram };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/run" || request.method !== "POST") {
      return new Response("not found", { status: 404 });
    }
    const token = request.headers.get("x-seed-token");
    if (!token || token !== env.SEED_TOKEN) return new Response("forbidden", { status: 403 });
    const wipe = url.searchParams.get("wipe") === "1";
    const db = env.CONTENT_DB;
    const bucket = env.APPLICATIONS_BUCKET;
    if (!db || !bucket) return Response.json({ error: "missing bindings" }, { status: 503 });

    if (wipe) {
      const { results } = await db.prepare("SELECT body_r2_key FROM reviews").all();
      for (const r of results) {
        try { await bucket.delete(r.body_r2_key); } catch {}
      }
      await db.prepare("DELETE FROM reviews").run();
      await db.prepare("DELETE FROM review_stats WHERE id='global'").run();
    }

    const start = Math.max(1, Number(url.searchParams.get("start") || 1));
    const end = Math.min(10000, Number(url.searchParams.get("end") || 10000));
    const rows = generateReviewRows(end).slice(start - 1, end);
    let ok = 0, duplicate = 0, invalid = 0;
    for (const row of rows) {
      try {
        const result = await insertReviewRecord(db, bucket, {
          body: row.body, rating: row.rating, displayName: row.displayName,
          publishedAt: row.publishedAt, tags: row.tags, source: "corpus_v1",
          sourceRowId: row.rowId, featured: row.featured, sortBoost: row.sortBoost, status: "published"
        });
        if (result.ok) ok++;
        else if (result.reason === "duplicate") duplicate++;
        else invalid++;
      } catch (e) {
        const msg = String(e?.message || e);
        if (/UNIQUE constraint failed/i.test(msg)) duplicate++;
        else invalid++;
      }
    }
    const stats = await rebuildReviewStats(db);
    return Response.json({ ok, duplicate, invalid, start, end, stats });
  }
};
`;

writeFileSync(path.join(root, ".one-shot-seed-worker.mjs"), worker);
console.log("Wrote scripts/.one-shot-seed-worker.mjs", worker.length, "bytes");
