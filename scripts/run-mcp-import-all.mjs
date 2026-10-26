#!/usr/bin/env node
/**
 * Generate MCP import chunks (100 rows each) for manual or automated Cloudflare MCP execute.
 * Usage: node scripts/run-mcp-import-all.mjs [--wipe-first]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "..", ".mcp-chunks");
const chunkSize = 100;
const total = 10_000;
const wipeFirst = process.argv.includes("--wipe-first");

mkdirSync(outDir, { recursive: true });
const manifest = [];

for (let start = 1; start <= total; start += chunkSize) {
  const count = Math.min(chunkSize, total - start + 1);
  const wipe = wipeFirst && start === 1;
  const proc = spawnSync(
    process.execPath,
    [path.join(root, "gen-mcp-import-chunk.mjs"), `--start=${start}`, `--count=${count}`, ...(wipe ? ["--wipe"] : [])],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (proc.status !== 0) {
    console.error(proc.stderr || proc.stdout);
    process.exit(proc.status || 1);
  }
  const name = `chunk-${String(start).padStart(5, "0")}.js`;
  writeFileSync(path.join(outDir, name), proc.stdout);
  manifest.push({ start, count, file: name, bytes: proc.stdout.length, wipe });
}

writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${manifest.length} chunks to ${outDir}`);
