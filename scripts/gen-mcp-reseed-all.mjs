#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const b64 = readFileSync(path.join(root, "..", ".seed-worker.b64"), "utf8").trim();
const seedToken = "reseed-usim-2026-10-26";
const scriptName = "usim-reviews-seed-once";

const code = `async () => {
  const scriptName = ${JSON.stringify(scriptName)};
  const seedToken = ${JSON.stringify(seedToken)};
  const script = atob(${JSON.stringify(b64)});
  const metadata = {
    main_module: "seed.mjs",
    compatibility_date: "2026-10-24",
    usage_model: "unbound",
    limits: { cpu_ms: 300000 },
    bindings: [
      { type: "d1", name: "CONTENT_DB", id: "23f98117-e3e7-4804-9d72-c8f15d812aa7" },
      { type: "r2_bucket", name: "APPLICATIONS_BUCKET", bucket_name: "usim-plus-applications" },
      { type: "plain_text", name: "SEED_TOKEN", text: seedToken }
    ]
  };
  const boundary = "----SeedBoundary" + Date.now();
  const body = [
    "--" + boundary,
    'Content-Disposition: form-data; name="metadata"',
    "Content-Type: application/json",
    "",
    JSON.stringify(metadata),
    "--" + boundary,
    'Content-Disposition: form-data; name="seed.mjs"; filename="seed.mjs"',
    "Content-Type: application/javascript+module",
    "",
    script,
    "--" + boundary + "--"
  ].join("\\r\\n");
  await cloudflare.request({
    method: "PUT",
    path: \`/accounts/\${accountId}/workers/scripts/\${scriptName}\`,
    body,
    contentType: "multipart/form-data; boundary=" + boundary,
    rawBody: true
  });
  try {
    await cloudflare.request({
      method: "POST",
      path: \`/accounts/\${accountId}/workers/scripts/\${scriptName}/subdomain\`,
      body: { enabled: true }
    });
  } catch {}
  const sub = await cloudflare.request({ method: "GET", path: \`/accounts/\${accountId}/workers/subdomain\` });
  const host = sub.result?.subdomain || (accountId + ".workers.dev");
  const runs = [];
  for (let start = 1; start <= 10000; start += 500) {
    const end = Math.min(start + 499, 10000);
    const wipe = start === 1 ? "1" : "0";
    const runUrl = \`https://\${scriptName}.\${host}/run?wipe=\${wipe}&start=\${start}&end=\${end}\`;
    const res = await fetch(runUrl, {
      method: "POST",
      headers: { "x-seed-token": seedToken },
      signal: AbortSignal.timeout(600000)
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text.slice(0, 300) };
    }
    runs.push({ start, end, status: res.status, result: parsed });
  }
  return { host, runs, final: runs.at(-1) };
}`;

writeFileSync(path.join(root, "..", ".mcp-reseed-all.js"), code);
console.log("Wrote .mcp-reseed-all.js", code.length, "bytes");
