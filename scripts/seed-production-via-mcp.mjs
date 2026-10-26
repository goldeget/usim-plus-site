#!/usr/bin/env node
/**
 * Run full 10k production seed via Cloudflare MCP execute (100 rows per chunk).
 * Requires Cursor Cloudflare MCP; uses gen-mcp-import-chunk export payloads.
 *
 * Usage: node scripts/seed-production-via-mcp.mjs [--dry-run]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes("--dry-run");
const chunkSize = 100;
const total = 10_000;

console.log(`Plan: ${total / chunkSize} MCP execute calls (${chunkSize} rows each)`);
console.log("Generate each chunk with: node scripts/gen-mcp-import-chunk.mjs --start=N --count=100 [--wipe]");
console.log("Then paste output into Cloudflare MCP execute (account 8359160c37fcc4cd253e2ca1df2fd63b).");
console.log("After all chunks: rebuild stats via admin or MCP SQL on review_stats.");

if (dry) {
  for (let start = 1; start <= total; start += chunkSize) {
    const wipe = start === 1 ? " --wipe" : "";
    console.log(`node scripts/gen-mcp-import-chunk.mjs --start=${start} --count=${chunkSize}${wipe}`);
  }
}
