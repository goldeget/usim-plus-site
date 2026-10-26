#!/usr/bin/env node
/**
 * Precompute review insert payloads (D1 row + R2 object) for Cloudflare API seeding.
 * Usage: node scripts/export-review-seed-payload.mjs --start=1 --count=50
 */
import { generateReviewRows } from "./generate-review-rows.mjs";
import { reviewHashes, validateReviewImportRecord } from "../functions/_lib/reviews.js";

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
const count = Math.max(1, Number(args.count || 50));
const end = start + count - 1;
const all = generateReviewRows(end);
const slice = all.slice(start - 1, end);

const rows = [];
const snippetSha = new Set();
for (const row of slice) {
  const importIssue = validateReviewImportRecord(row);
  if (importIssue) {
    console.error(`Invalid corpus row ${row.rowId}: ${importIssue}`);
    process.exit(1);
  }
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 26);
  const now = new Date().toISOString();
  const publishedAt = row.publishedAt || now;
  const hashes = await reviewHashes(row.body);
  if (snippetSha.has(hashes.snippet_sha256)) {
    console.error(`Duplicate snippet in export at ${row.rowId}`);
    process.exit(1);
  }
  snippetSha.add(hashes.snippet_sha256);
  const r2Key = `reviews/bodies/${id}.json`;
  rows.push({
    id,
    publishedAt,
    rating: row.rating,
    snippet: hashes.snippet,
    snippet_sha256: hashes.snippet_sha256,
    body_sha256: hashes.body_sha256,
    body_norm_sha256: hashes.body_norm_sha256,
    r2Key,
    body_byte_length: hashes.body_byte_length,
    displayName: String(row.displayName || "참여자").slice(0, 40),
    tags_json: JSON.stringify(row.tags || {}),
    source: "corpus_v1",
    source_row_id: row.rowId,
    status: "published",
    featured: row.featured ? 1 : 0,
    sort_boost: Number(row.sortBoost) || 0,
    created_at: now,
    updated_at: now,
    r2Payload: JSON.stringify({
      id,
      body: row.body,
      rating: row.rating,
      publishedAt,
      importedAt: now
    })
  });
}

process.stdout.write(JSON.stringify({ start, count: rows.length, rows }));
