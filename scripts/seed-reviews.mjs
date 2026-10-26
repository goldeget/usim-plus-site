#!/usr/bin/env node
/**
 * Seed reviews into D1 + R2 via the same insert logic as production.
 * Usage:
 *   node scripts/seed-reviews.mjs --count 10000
 * Requires wrangler logged in; applies migration 0005 first if needed.
 */
import { spawnSync } from "node:child_process";
import { generateReviewRows } from "./generate-review-rows.mjs";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { extendReviewsDb } from "../test-support/reviews-db.js";
import { insertReviewRecord, rebuildReviewStats, REVIEW_CAP } from "../functions/_lib/reviews.js";

const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith("--count="));
const count = Math.min(Number(countArg?.split("=")[1] || 10_000), REVIEW_CAP);
const remote = args.includes("--remote");

function runWrangler(argsList) {
  const wrangler = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(wrangler, ["wrangler", ...argsList], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Minimal D1/R2 bridge using wrangler for remote, memory for local default. */
async function seedLocal(rows) {
  const store = createMemoryCloudflare();
  extendReviewsDb(store.CONTENT_DB, store.APPLICATIONS_BUCKET);
  let ok = 0;
  let duplicate = 0;
  for (const row of rows) {
    const result = await insertReviewRecord({
      db: store.CONTENT_DB,
      bucket: store.APPLICATIONS_BUCKET,
      record: {
        body: row.body,
        rating: row.rating,
        displayName: row.displayName,
        publishedAt: row.publishedAt,
        tags: row.tags,
        source: "corpus_v1",
        sourceRowId: row.rowId,
        featured: row.featured,
        sortBoost: row.sortBoost,
        status: "published"
      }
    });
    if (result.ok) ok += 1;
    else if (result.reason === "duplicate") duplicate += 1;
  }
  await rebuildReviewStats(store.CONTENT_DB);
  console.log(`Local seed: ok=${ok} duplicate=${duplicate}`);
}

async function seedRemote(rows) {
  console.log("Applying migrations (remote)...");
  runWrangler(["d1", "migrations", "apply", "usim-plus-content", "--remote"]);

  const batchSize = 40;
  let imported = 0;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const payload = JSON.stringify({ source: "corpus_v1", reviews: batch.map(r => ({
      rowId: r.rowId,
      body: r.body,
      rating: r.rating,
      displayName: r.displayName,
      publishedAt: r.publishedAt,
      tags: r.tags,
      featured: Boolean(r.featured),
      sortBoost: r.sortBoost
    })) });
    const tmp = `seed-batch-${offset}.json`;
    await import("node:fs/promises").then(fs => fs.writeFile(tmp, payload));
    console.log(`Import batch ${offset / batchSize + 1} / ${Math.ceil(rows.length / batchSize)} via admin API...`);
    console.log("Upload this file from admin /admin/reviews.html or use authenticated curl to POST /api/admin/reviews");
    imported += batch.length;
  }
  console.log(`Prepared ${imported} rows in batch files seed-batch-*.json (use admin import).`);
}

const rows = generateReviewRows(count);
if (remote) await seedRemote(rows);
else await seedLocal(rows);
