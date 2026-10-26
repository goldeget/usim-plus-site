#!/usr/bin/env node
/**
 * Import precomputed review payloads via Cloudflare API (D1 + R2).
 * Requires CLOUDFLARE_API_TOKEN with D1 Edit + R2 write.
 * Usage: node scripts/import-review-payload-cloudflare.mjs --file=batch.json
 */
import { readFileSync } from "node:fs";
import { reviewTextContainsInternalId } from "../functions/_lib/reviews.js";

const accountId = process.env.CF_ACCOUNT_ID || "8359160c37fcc4cd253e2ca1df2fd63b";
const dbId = process.env.CF_D1_ID || "23f98117-e3e7-4804-9d72-c8f15d812aa7";
const bucket = process.env.CF_R2_BUCKET || "usim-plus-applications";
const token = process.env.CLOUDFLARE_API_TOKEN;

const fileArg = process.argv.find(a => a.startsWith("--file="));
if (!token || !fileArg) {
  console.error("Set CLOUDFLARE_API_TOKEN and --file=...");
  process.exit(1);
}

const { rows } = JSON.parse(readFileSync(fileArg.split("=")[1], "utf8"));

async function cf(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`${method} ${path}: ${JSON.stringify(data.errors)}`);
  }
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
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: text
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(`R2 put ${key}: ${JSON.stringify(data.errors)}`);
}

let ok = 0;
let duplicate = 0;
let invalid = 0;

for (const row of rows) {
  try {
    const r2 = JSON.parse(row.r2Payload);
    if (reviewTextContainsInternalId(r2.body) || reviewTextContainsInternalId(row.displayName)) {
      invalid++;
      console.error(`Skip ${row.id}: internal corpus id in public text`);
      continue;
    }
    await putR2(row.r2Key, row.r2Payload);
    await d1(
      `INSERT INTO reviews (
        id, published_at, rating, snippet, snippet_sha256, body_sha256, body_norm_sha256,
        body_r2_key, body_byte_length, display_name, tags_json, source, source_row_id,
        status, featured, sort_boost, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.publishedAt,
        row.rating,
        row.snippet,
        row.snippet_sha256,
        row.body_sha256,
        row.body_norm_sha256,
        row.r2Key,
        row.body_byte_length,
        row.displayName,
        row.tags_json,
        row.source,
        row.source_row_id,
        row.status,
        row.featured,
        row.sort_boost,
        row.created_at,
        row.updated_at
      ]
    );
    ok++;
  } catch (e) {
    const msg = String(e.message || e);
    if (/UNIQUE constraint failed/i.test(msg)) duplicate++;
    else {
      invalid++;
      console.error(msg);
    }
  }
}

const statsRow = await d1(
  `SELECT COUNT(*) AS total,
          SUM(rating) AS rating_sum,
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

console.log(JSON.stringify({ ok, duplicate, invalid, total, avgRating: avg }));
