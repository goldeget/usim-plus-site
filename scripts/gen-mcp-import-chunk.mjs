#!/usr/bin/env node
/**
 * Emit Cloudflare MCP `execute` snippet to import one precomputed chunk (D1 + R2).
 * Usage: node scripts/gen-mcp-import-chunk.mjs --start=1 --count=500 [--wipe]
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
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
const count = Math.max(1, Number(args.count || 500));
const wipe = args.wipe === "true" || args.wipe === true;

const exportScript = path.join(root, "export-review-seed-payload.mjs");
const proc = spawnSync(process.execPath, [exportScript, `--start=${start}`, `--count=${count}`], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024
});
if (proc.status !== 0) {
  process.stderr.write(proc.stderr || proc.stdout);
  process.exit(proc.status || 1);
}
const { rows } = JSON.parse(proc.stdout);

const code = `async () => {
  const dbId = "23f98117-e3e7-4804-9d72-c8f15d812aa7";
  const bucket = "usim-plus-applications";
  const rows = ${JSON.stringify(rows)};
  const d1 = async (sql, params = []) =>
    cloudflare.request({
      method: "POST",
      path: \`/accounts/\${accountId}/d1/database/\${dbId}/query\`,
      body: params.length ? { sql, params } : { sql }
    });
  const r2 = async (key, text) =>
    cloudflare.request({
      method: "PUT",
      path: \`/accounts/\${accountId}/r2/buckets/\${bucket}/objects/\${encodeURIComponent(key).replace(/%2F/g, "/")}\`,
      body: text,
      contentType: "application/json; charset=utf-8",
      rawBody: true
    });
  if (${wipe ? "true" : "false"}) {
    await d1("DELETE FROM reviews");
    await d1("DELETE FROM review_stats WHERE id = 'global'");
  }
  let ok = 0, duplicate = 0, invalid = 0, errors = [];
  for (const row of rows) {
    try {
      if (/corpus-\\\\d{5}/i.test(row.snippet || "") || /corpus-\\\\d{5}/i.test(JSON.parse(row.r2Payload).body || "")) {
        invalid++;
        continue;
      }
      await r2(row.r2Key, row.r2Payload);
      await d1(
        \`INSERT INTO reviews (
          id, published_at, rating, snippet, snippet_sha256, body_sha256, body_norm_sha256,
          body_r2_key, body_byte_length, display_name, tags_json, source, source_row_id,
          status, featured, sort_boost, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
        [
          row.id, row.publishedAt, row.rating, row.snippet, row.snippet_sha256, row.body_sha256,
          row.body_norm_sha256, row.r2Key, row.body_byte_length, row.displayName, row.tags_json,
          row.source, row.source_row_id, row.status, row.featured, row.sort_boost, row.created_at, row.updated_at
        ]
      );
      ok++;
    } catch (e) {
      const msg = String(e.message || e);
      if (/UNIQUE constraint failed/i.test(msg)) duplicate++;
      else {
        invalid++;
        if (errors.length < 3) errors.push(msg.slice(0, 200));
      }
    }
  }
  const cnt = await d1("SELECT COUNT(*) AS c FROM reviews WHERE status = 'published'");
  return { ok, duplicate, invalid, errors, published: cnt.result?.[0]?.results?.[0]?.c ?? cnt.result?.[0]?.c };
}`;

process.stdout.write(code);
