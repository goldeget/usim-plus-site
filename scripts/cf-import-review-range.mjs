#!/usr/bin/env node
/**
 * Import a review index range to production D1+R2 via Cloudflare API.
 * Same corpus as generate-review-rows.mjs (unique bodies, 3y dates).
 *
 *   set CLOUDFLARE_API_TOKEN=...
 *   node scripts/cf-import-review-range.mjs --start=1 --end=10000 --wipe
 */
import { generateReviewRows } from "./generate-review-rows.mjs";
import { reviewHashes, validateReviewImportRecord } from "../functions/_lib/reviews.js";

const accountId = process.env.CF_ACCOUNT_ID || "8359160c37fcc4cd253e2ca1df2fd63b";
const dbId = process.env.CF_D1_ID || "23f98117-e3e7-4804-9d72-c8f15d812aa7";
const bucket = process.env.CF_R2_BUCKET || "usim-plus-applications";
const token = process.env.CLOUDFLARE_API_TOKEN;

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? "true"];
    })
);
const start = Math.max(1, Number(args.start || 1));
const end = Math.max(start, Number(args.end || start));
const wipe = args.wipe === "true" || args.wipe === true;

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

async function cf(path, { method = "GET", body, contentType } = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": contentType || "application/json" } : {})
    },
    body: body && contentType !== "raw" ? (typeof body === "string" ? body : JSON.stringify(body)) : body
  });
  const data = await res.json();
  if (!data.success) throw new Error(`${method} ${path}: ${JSON.stringify(data.errors)}`);
  return data;
}

async function d1(sql, params = []) {
  const body = params.length ? { sql, params } : { sql };
  const data = await cf(`/accounts/${accountId}/d1/database/${dbId}/query`, { method: "POST", body });
  return data.result?.[0];
}

async function putR2(key, text) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: text
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(`R2 put: ${JSON.stringify(data.errors)}`);
}

async function rebuildStats() {
  const statsRow = await d1(
    `SELECT COUNT(*) AS total, SUM(rating) AS rating_sum,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS r1,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS r2,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS r3,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS r4,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS r5
     FROM reviews WHERE status = 'published'`
  );
  const r = statsRow?.results?.[0] || {};
  const total = Number(r.total || 0);
  const ratingSum = Number(r.rating_sum || 0);
  const histogram = {
    "1": Number(r.r1 || 0),
    "2": Number(r.r2 || 0),
    "3": Number(r.r3 || 0),
    "4": Number(r.r4 || 0),
    "5": Number(r.r5 || 0)
  };
  const avg = total > 0 ? Math.round((ratingSum / total) * 10) / 10 : 0;
  const updatedAt = new Date().toISOString();
  await d1(
    `INSERT INTO review_stats (id, total_published, avg_rating, histogram_json, rating_sum, updated_at)
     VALUES ('global', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       total_published = excluded.total_published,
       avg_rating = excluded.avg_rating,
       histogram_json = excluded.histogram_json,
       rating_sum = excluded.rating_sum,
       updated_at = excluded.updated_at`,
    [total, avg, JSON.stringify(histogram), ratingSum, updatedAt]
  );
  return { total, avgRating: avg, histogram };
}

if (wipe) {
  console.log("Wiping reviews + global stats…");
  await d1("DELETE FROM reviews");
  await d1("DELETE FROM review_stats WHERE id = 'global'");
}

const rows = generateReviewRows(end).slice(start - 1, end);
let ok = 0;
let duplicate = 0;
let invalid = 0;

for (const row of rows) {
  const issue = validateReviewImportRecord(row);
  if (issue) {
    invalid++;
    console.error(`Skip ${row.rowId}: ${issue}`);
    continue;
  }
  try {
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 26);
    const now = new Date().toISOString();
    const publishedAt = row.publishedAt || now;
    const hashes = await reviewHashes(row.body);
    const r2Key = `reviews/bodies/${id}.json`;
    await putR2(
      r2Key,
      JSON.stringify({ id, body: row.body, rating: row.rating, publishedAt, importedAt: now })
    );
    await d1(
      `INSERT INTO reviews (
        id, published_at, rating, snippet, snippet_sha256, body_sha256, body_norm_sha256,
        body_r2_key, body_byte_length, display_name, tags_json, source, source_row_id,
        status, featured, sort_boost, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        publishedAt,
        row.rating,
        hashes.snippet,
        hashes.snippet_sha256,
        hashes.body_sha256,
        hashes.body_norm_sha256,
        r2Key,
        hashes.body_byte_length,
        String(row.displayName || "참여자").slice(0, 40),
        JSON.stringify(row.tags || {}),
        "corpus_v1",
        row.rowId,
        "published",
        row.featured ? 1 : 0,
        Number(row.sortBoost) || 0,
        now,
        now
      ]
    );
    ok++;
    if (ok % 250 === 0) console.log(`… ${ok} rows (${row.rowId})`);
  } catch (e) {
    const msg = String(e.message || e);
    if (/UNIQUE constraint failed/i.test(msg)) duplicate++;
    else {
      invalid++;
      console.error(msg);
    }
  }
}

const stats = await rebuildStats();
console.log(JSON.stringify({ ok, duplicate, invalid, start, end, stats }, null, 2));
