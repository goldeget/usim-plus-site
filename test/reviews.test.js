import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import {
  insertReviewRecord,
  normalizeForDedup,
  normalizeReviewBody,
  rebuildReviewStats,
  reviewHashes
} from "../functions/_lib/reviews.js";
import { extendReviewsDb } from "../test-support/reviews-db.js";

test("normalizes review bodies and treats near-duplicates as identical for dedup hash", async () => {
  const a = normalizeForDedup("  안녕하세요!!\n\n상담이  친절했습니다.  ");
  const b = normalizeForDedup("안녕하세요 상담이 친절했습니다");
  assert.equal(a, b);
  const h1 = await reviewHashes(normalizeReviewBody("가".repeat(40)));
  const h2 = await reviewHashes(normalizeReviewBody("가".repeat(40)));
  assert.equal(h1.body_sha256, h2.body_sha256);
  assert.notEqual(h1.body_sha256, (await reviewHashes("가".repeat(41))).body_sha256);
});

test("rejects duplicate reviews at insert time", async () => {
  const store = createMemoryCloudflare();
  extendReviewsDb(store.CONTENT_DB, store.APPLICATIONS_BUCKET);
  const body = "유심 개통 상담 과정이 차분하게 안내되어 이해하기 쉬웠습니다. " + "가".repeat(8);
  const first = await insertReviewRecord({
    db: store.CONTENT_DB,
    bucket: store.APPLICATIONS_BUCKET,
    record: { body, rating: 5, displayName: "참여자A", source: "test", sourceRowId: "1" }
  });
  const second = await insertReviewRecord({
    db: store.CONTENT_DB,
    bucket: store.APPLICATIONS_BUCKET,
    record: { body, rating: 4, displayName: "참여자B", source: "test", sourceRowId: "2" }
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.reason, "duplicate");
  const stats = await rebuildReviewStats(store.CONTENT_DB);
  assert.equal(stats.total, 1);
});

test("public reviews stats endpoint returns aggregated totals", async () => {
  const store = createMemoryCloudflare();
  extendReviewsDb(store.CONTENT_DB, store.APPLICATIONS_BUCKET);
  await insertReviewRecord({
    db: store.CONTENT_DB,
    bucket: store.APPLICATIONS_BUCKET,
    record: {
      body: "조회 후 상담까지 한 번에 연결되어 번거롭지 않았습니다. " + "나".repeat(12),
      rating: 5,
      displayName: "김*희",
      source: "test"
    }
  });
  await rebuildReviewStats(store.CONTENT_DB);
  const { onRequest } = await import("../functions/api/reviews/stats.js");
  const response = await onRequest({
    request: new Request("https://climekr.com/api/reviews/stats"),
    env: { CONTENT_DB: store.CONTENT_DB }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.total, 1);
  assert.equal(data.avgRating, 5);
  assert.match(response.headers.get("Cache-Control"), /s-maxage=300/);
});

test("reviews hub is linked from sitemap and home without Review schema", async () => {
  const home = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  const reviewsPage = await readFile(new URL("../public/reviews/index.html", import.meta.url), "utf8");
  assert.match(sitemap, /<loc>https:\/\/climekr\.com\/reviews\/<\/loc>/);
  assert.match(home, /id="homeReviews"/);
  assert.match(home, /href="\/reviews\/"/);
  assert.doesNotMatch(reviewsPage, /AggregateRating|"@type"\s*:\s*"Review"/);
});
