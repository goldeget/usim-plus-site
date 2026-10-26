#!/usr/bin/env node
/**
 * Remote bulk import via admin session cookie.
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-reviews-admin.mjs --count=10000
 * Optional: ADMIN_ORIGIN=https://admin.climekr.com (default)
 */
import { readFileSync } from "node:fs";
import { generateReviewRows } from "./generate-review-rows.mjs";
import { REVIEW_CAP } from "../functions/_lib/reviews.js";

const FETCH_TIMEOUT_MS = 180_000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith("--count="));
const count = Math.min(Number(countArg?.split("=")[1] || 10_000), REVIEW_CAP);
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

const rows = generateReviewRows(count);
const cookie = await login();
let ok = 0;
let duplicate = 0;
let invalid = 0;
for (let offset = 0; offset < rows.length; offset += batchSize) {
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
  const result = await importBatch(cookie, batch);
  ok += result.ok || 0;
  duplicate += result.duplicate || 0;
  invalid += result.invalid || 0;
  console.log(`Batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} ok=${result.ok} dup=${result.duplicate}`);
}
await rebuildStats(cookie);
console.log(`Done: ok=${ok} duplicate=${duplicate} invalid=${invalid}`);
