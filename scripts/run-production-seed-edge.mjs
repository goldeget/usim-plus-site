#!/usr/bin/env node
/**
 * Deploy one-shot seed worker and import 10k reviews using Wrangler OAuth token (local).
 * Does not print tokens.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const accountId = "8359160c37fcc4cd253e2ca1df2fd63b";
const seedToken = "reseed-usim-2026-10-26";
const scriptName = "usim-reviews-seed-once";

function loadOAuthToken() {
  const configPath = path.join(homedir(), "AppData", "Roaming", "xdg.config", ".wrangler", "config", "default.toml");
  const toml = readFileSync(configPath, "utf8");
  const match = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("Wrangler oauth_token not found");
  return match[1];
}

const token = process.env.CLOUDFLARE_API_TOKEN || loadOAuthToken();
const script = readFileSync(path.join(root, ".one-shot-seed-worker.mjs"), "utf8");

async function cf(pathname, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body
  });
  const data = await res.json();
  if (!data.success) throw new Error(`${method} ${pathname}: ${JSON.stringify(data.errors)}`);
  return data;
}

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

const boundary = `----Seed${Date.now()}`;
const deployBody = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="metadata"',
  "Content-Type: application/json",
  "",
  JSON.stringify(metadata),
  `--${boundary}`,
  'Content-Disposition: form-data; name="seed.mjs"; filename="seed.mjs"',
  "Content-Type: application/javascript+module",
  "",
  script,
  `--${boundary}--`
].join("\r\n");

console.log("Deploying seed worker...");
await cf(`/accounts/${accountId}/workers/scripts/${scriptName}`, {
  method: "PUT",
  headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  body: deployBody
});

try {
  await cf(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true })
  });
} catch {}

const sub = await cf(`/accounts/${accountId}/workers/subdomain`);
const host = sub.result?.subdomain;
console.log("Worker host:", host);

const runs = [];
for (let start = 1; start <= 10_000; start += 500) {
  const end = Math.min(start + 499, 10_000);
  const wipe = start === 1 ? "1" : "0";
  const url = `https://${scriptName}.${host}/run?wipe=${wipe}&start=${start}&end=${end}`;
  console.log(`Chunk ${start}-${end}...`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-seed-token": seedToken },
    signal: AbortSignal.timeout(600_000)
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 400) };
  }
  runs.push({ start, end, status: res.status, result: parsed });
  if (res.status !== 200) {
    console.error("Chunk failed", start, end, parsed);
    process.exit(1);
  }
  console.log(`  ok=${parsed.ok} stats.total=${parsed.stats?.total}`);
}

try {
  await cf(`/accounts/${accountId}/workers/scripts/${scriptName}`, { method: "DELETE" });
} catch {}

console.log("Done.", JSON.stringify(runs.at(-1)?.result?.stats ?? {}, null, 2));
