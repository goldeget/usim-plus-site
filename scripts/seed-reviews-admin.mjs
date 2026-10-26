#!/usr/bin/env node
/**
 * Remote bulk import via admin session cookie.
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-reviews-admin.mjs --count=10000
 *   ... --start-batch=13 --end-batch=200   # resume after partial run
 *
 * Production re-seed (fixes legacy rows whose bodies/snippets contained corpus-XXXXX):
 * 1. Deploy this repo so admin import rejects internal ids in public text.
 * 2. Wipe bad rows (one-shot worker with ?wipe=1, or DELETE reviews + R2 bodies/*).
 * 3. Re-run this script with --count=10000 (or export/import payloads).
 *    Existing corpus_v1 source_row_id values dedupe re-import; a full wipe is required
 *    when replacing in-place rows that already consumed those ids.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import { generateReviewRows, REVIEW_CORPUS_VERSION } from "./generate-review-rows.mjs";
import { REVIEW_CAP } from "../functions/_lib/reviews.js";

const REQUEST_TIMEOUT_MS = 300_000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const corpusCache = join(__dirname, ".reviews-corpus.cache.json");

function httpsRequest(url, options = {}) {
  const target = new URL(url);
  const body = options.body ? Buffer.from(options.body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: options.method || "GET",
        headers: {
          ...(body ? { "Content-Length": body.length } : {}),
          ...options.headers
        },
        timeout: REQUEST_TIMEOUT_MS
      },
      res => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const setCookie = res.headers["set-cookie"];
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: {
              get(name) {
                const key = String(name).toLowerCase();
                if (key === "set-cookie") {
                  return Array.isArray(setCookie) ? setCookie.join("; ") : setCookie || null;
                }
                return res.headers[key] ?? null;
              },
              getSetCookie() {
                return Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
              }
            },
            json: async () => (text ? JSON.parse(text) : {}),
            text: async () => text
          });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchWithTimeout(url, options = {}, attempt = 1) {
  const maxAttempts = 8;
  try {
    return await httpsRequest(url, options);
  } catch (error) {
    if (attempt >= maxAttempts) throw error;
    const delay = Math.min(3000 * attempt, 30_000);
    console.warn(`Fetch retry ${attempt}/${maxAttempts} in ${delay}ms: ${error?.message || error}`);
    await new Promise(r => setTimeout(r, delay));
    return fetchWithTimeout(url, options, attempt + 1);
  }
}

const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith("--count="));
const count = Math.min(Number(countArg?.split("=")[1] || 10_000), REVIEW_CAP);
const startBatchArg = args.find(a => a.startsWith("--start-batch="));
const endBatchArg = args.find(a => a.startsWith("--end-batch="));
const startBatch = Math.max(Number(startBatchArg?.split("=")[1] || 1), 1);
const endBatch = endBatchArg ? Math.max(Number(endBatchArg.split("=")[1]), startBatch) : null;
const origin = process.env.ADMIN_ORIGIN || "https://admin.climekr.com";
const email = process.env.ADMIN_EMAIL;
const password =
  process.env.ADMIN_PASSWORD ||
  (process.env.ADMIN_PASSWORD_FILE
    ? readFileSync(process.env.ADMIN_PASSWORD_FILE, "utf8").trim()
    : "");
const batchSize = 50;

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.");
  process.exit(1);
}

async function login() {
  const response = await fetchWithTimeout(`${origin}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Login failed (${response.status})`);
  }
  const cookie = response.headers.getSetCookie?.()?.join("; ") || response.headers.get("set-cookie");
  if (!cookie) throw new Error("No session cookie from login");
  return cookie;
}

async function importBatch(cookie, reviews) {
  const response = await fetchWithTimeout(`${origin}/api/admin/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: origin,
      Cookie: cookie
    },
    body: JSON.stringify({ source: "corpus_v1", reviews })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Import failed (${response.status})`);
  return data;
}

async function rebuildStats(cookie) {
  await fetchWithTimeout(`${origin}/api/admin/reviews/rebuild-stats`, {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie }
  });
}

function loadCorpusRows(targetCount) {
  if (existsSync(corpusCache)) {
    try {
      const parsed = JSON.parse(readFileSync(corpusCache, "utf8"));
      const cachedRows = Array.isArray(parsed) ? parsed : parsed?.rows;
      const version = Array.isArray(parsed) ? null : parsed?.version;
      if (
        version === REVIEW_CORPUS_VERSION &&
        Array.isArray(cachedRows) &&
        cachedRows.length === targetCount
      ) {
        return cachedRows;
      }
    } catch {
      /* regenerate below */
    }
  }
  const generated = generateReviewRows(targetCount);
  writeFileSync(
    corpusCache,
    JSON.stringify({ version: REVIEW_CORPUS_VERSION, rows: generated })
  );
  return generated;
}

const rows = loadCorpusRows(count);

let ok = 0;
let duplicate = 0;
let invalid = 0;
const startOffset = (startBatch - 1) * batchSize;
const lastBatch = endBatch || Math.ceil(rows.length / batchSize);
const endOffsetExclusive = Math.min(lastBatch * batchSize, rows.length);
console.log(`Seeding ${count} rows (batches ${startBatch}-${lastBatch}, cache ${rows.length})`);
let cookie = await login();
console.log("Admin session ready");

for (let offset = startOffset; offset < endOffsetExclusive; offset += batchSize) {
  const batchNum = Math.floor(offset / batchSize) + 1;
  const batch = rows.slice(offset, offset + batchSize).map(r => ({
    rowId: r.rowId,
    body: r.body,
    rating: r.rating,
    displayName: r.displayName,
    publishedAt: r.publishedAt,
    tags: r.tags,
    featured: Boolean(r.featured),
    sortBoost: r.sortBoost
  }));
  let result = { ok: 0, duplicate: 0, invalid: 0 };
  let batchDone = false;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      result = await importBatch(cookie, batch);
      batchDone = true;
      break;
    } catch (error) {
      if (attempt >= 8) {
        console.error(`Batch ${batchNum} failed after retries: ${error?.message || error}`);
        break;
      }
      const delay = Math.min(4000 * attempt, 45_000);
      console.warn(`Batch ${batchNum} retry ${attempt}/8 in ${delay}ms: ${error?.message || error}`);
      await new Promise(r => setTimeout(r, delay));
      if (attempt % 2 === 0) cookie = await login();
    }
  }
  if (batchDone) {
    ok += result.ok || 0;
    duplicate += result.duplicate || 0;
    invalid += result.invalid || 0;
    console.log(`Batch ${batchNum}/${Math.ceil(rows.length / batchSize)} ok=${result.ok} dup=${result.duplicate}`);
  }
  await new Promise(r => setTimeout(r, 600));
}

try {
  await rebuildStats(cookie);
} catch (error) {
  console.warn(`rebuild-stats failed (re-run manually): ${error?.message || error}`);
}
console.log(`Done: ok=${ok} duplicate=${duplicate} invalid=${invalid}`);
