#!/usr/bin/env node
/**
 * Patch published corpus_v1 ratings in D1 to match generate-review-rows ratingForIndex (mean 4.8 @ 10k).
 * Requires CLOUDFLARE_API_TOKEN with D1 Edit.
 *
 * Usage: CLOUDFLARE_API_TOKEN=... node scripts/update-corpus-ratings-d1.mjs [--count=10000]
 */
import { generateReviewRows } from "./generate-review-rows.mjs";

const accountId = process.env.CF_ACCOUNT_ID || "8359160c37fcc4cd253e2ca1df2fd63b";
const dbId = process.env.CF_D1_ID || "23f98117-e3e7-4804-9d72-c8f15d812aa7";
const token = process.env.CLOUDFLARE_API_TOKEN;
const countArg = process.argv.find(a => a.startsWith("--count="));
const count = Number(countArg?.split("=")[1] || 10_000);

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const rows = generateReviewRows(count);
const ratingByRowId = new Map(rows.map(r => [r.rowId, r.rating]));
const ratingByCorpusId = new Map(rows.map(r => [`corpus-${r.rowId}`, r.rating]));

async function d1(sql, params = []) {
  const body = params.length ? { sql, params } : { sql };
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.success) throw new Error(JSON.stringify(data.errors));
  return data.result?.[0];
}

const listed = await d1(
  `SELECT id, source_row_id, rating FROM reviews WHERE source = 'corpus_v1' AND status = 'published'`
);
const items = listed?.results || [];
let updated = 0;
let skipped = 0;
for (const row of items) {
  const key = String(row.source_row_id || "");
  const next =
    ratingByRowId.get(key) ??
    ratingByCorpusId.get(key) ??
    ratingByRowId.get(key.replace(/^corpus-/, ""));
  if (!next || next === row.rating) {
    skipped += 1;
    continue;
  }
  await d1(`UPDATE reviews SET rating = ?, updated_at = ? WHERE id = ?`, [
    next,
    new Date().toISOString(),
    row.id
  ]);
  updated += 1;
}

const statsRow = (
  await d1(
    `SELECT COUNT(*) AS total, SUM(rating) AS rating_sum,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS r1,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS r2,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS r3,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS r4,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS r5
     FROM reviews WHERE status = 'published'`
  )
)?.results?.[0] || {};
const total = Number(statsRow.total || 0);
const ratingSum = Number(statsRow.rating_sum || 0);
const histogram = {
  "1": Number(statsRow.r1 || 0),
  "2": Number(statsRow.r2 || 0),
  "3": Number(statsRow.r3 || 0),
  "4": Number(statsRow.r4 || 0),
  "5": Number(statsRow.r5 || 0)
};
const avg = total > 0 ? Math.round((ratingSum / total) * 10) / 10 : 0;
await d1(
  `INSERT INTO review_stats (id, total_published, avg_rating, histogram_json, rating_sum, updated_at)
   VALUES ('global', ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     total_published = excluded.total_published,
     avg_rating = excluded.avg_rating,
     histogram_json = excluded.histogram_json,
     rating_sum = excluded.rating_sum,
     updated_at = excluded.updated_at`,
  [total, avg, JSON.stringify(histogram), ratingSum, new Date().toISOString()]
);

console.log(JSON.stringify({ updated, skipped, total, avgRating: avg, histogram }));
