#!/usr/bin/env node
/**
 * Retry failed admin import batches (ECONNRESET / timeouts) without restarting from batch 1.
 * Usage: same env as seed-reviews-admin.mjs; optional --max-batch=200
 */
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const maxBatchArg = args.find(a => a.startsWith("--max-batch="));
const maxBatch = Number(maxBatchArg?.split("=")[1] || 200);
const startBatchArg = args.find(a => a.startsWith("--start-batch="));
const startBatch = Math.max(Number(startBatchArg?.split("=")[1] || 1), 1);
const countArg = args.find(a => a.startsWith("--count=")) || "--count=10000";
const script = path.join(root, "seed-reviews-admin.mjs");

for (let batch = startBatch; batch <= maxBatch; batch += 1) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const r = spawnSync(process.execPath, [script, countArg, `--start-batch=${batch}`, `--end-batch=${batch}`], {
      stdio: "inherit",
      env: process.env
    });
    if (r.status === 0) break;
    const delay = Math.min(5000 * attempt, 60_000);
    console.warn(`Batch ${batch} failed (exit ${r.status}); retry ${attempt}/8 in ${delay}ms`);
    await sleep(delay);
    if (attempt >= 8) process.exit(r.status || 1);
  }
}
console.log("All batches completed.");
