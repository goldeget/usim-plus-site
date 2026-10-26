import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import {
  insertReviewRecord,
  normalizeForDedup,
  normalizeReviewBody,
  rebuildReviewStats,
  reviewHashes,
  REVIEW_INTERNAL_ID_PATTERN
} from "../functions/_lib/reviews.js";
import { extendReviewsDb } from "../test-support/reviews-db.js";
import { reviewAssetsEnv } from "../test-support/review-assets.js";

test("normalizes review bodies and treats near-duplicates as identical for dedup hash", async () => {
  const a = normalizeForDedup("  안녕하세요!!\n\n상담이  친절했습니다.  ");
  const b = normalizeForDedup("안녕하세요 상담이 친절했습니다");
  assert.equal(a, b);
  const h1 = await reviewHashes(normalizeReviewBody("가".repeat(40)));
  const h2 = await reviewHashes(normalizeReviewBody("가".repeat(40)));
  assert.equal(h1.body_sha256, h2.body_sha256);
  assert.notEqual(h1.body_sha256, (await reviewHashes("가".repeat(41))).body_sha256);
});

test("rejects review bodies that embed internal corpus row ids", async () => {
  const store = createMemoryCloudflare();
  extendReviewsDb(store.CONTENT_DB, store.APPLICATIONS_BUCKET);
  const body =
    "유심플러스 참여 후기 corpus-00001. 채널톡·텔레그램·LINE 상담 후 조건 확인하고 진행했습니다. " +
    "가".repeat(20);
  const result = await insertReviewRecord({
    db: store.CONTENT_DB,
    bucket: store.APPLICATIONS_BUCKET,
    record: { body, rating: 5, displayName: "참여1", source: "test", sourceRowId: "corpus-00001" }
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "internal_id_in_body");
});

test("public reviews list and detail read the static corpus, not D1", async () => {
  const env = reviewAssetsEnv();
  const { onRequest: listHandler } = await import("../functions/api/reviews/index.js");
  const listRes = await listHandler({
    request: new Request("https://climekr.com/api/reviews?limit=10"),
    env
  });
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.equal(list.items.length, 10);
  for (let i = 1; i < list.items.length; i += 1) {
    assert.ok(
      list.items[i - 1].publishedAt >= list.items[i].publishedAt,
      "public list is published_at DESC (newest first)"
    );
  }
  const snippets = list.items.map(item => item.snippet);
  assert.equal(new Set(snippets).size, snippets.length, "each list item must have a distinct snippet");
  for (const item of list.items) {
    assert.doesNotMatch(item.snippet, REVIEW_INTERNAL_ID_PATTERN);
    assert.doesNotMatch(item.displayName, REVIEW_INTERNAL_ID_PATTERN);
    assert.doesNotMatch(item.snippet, /\d+\s*분경/);
  }

  const { onRequest: detailHandler } = await import("../functions/api/reviews/[id].js");
  const detailRes = await detailHandler({
    request: new Request(`https://climekr.com/api/reviews/${list.items[0].id}`),
    env,
    params: { id: list.items[0].id }
  });
  assert.equal(detailRes.status, 200);
  const detail = await detailRes.json();
  assert.equal(detail.id, list.items[0].id);
  assert.doesNotMatch(detail.body, REVIEW_INTERNAL_ID_PATTERN);
  assert.doesNotMatch(detail.body, /\d+\s*분경/);
  assert.ok(detail.body.length > list.items[0].snippet.replace(/…$/, "").length);
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

test("public reviews stats endpoint returns the static 10000-review aggregate", async () => {
  const { onRequest } = await import("../functions/api/reviews/stats.js");
  const response = await onRequest({
    request: new Request("https://climekr.com/api/reviews/stats"),
    env: reviewAssetsEnv()
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.total, 10_000);
  assert.equal(data.avgRating, 4.8);
  assert.equal(data.histogram["5"], 8100);
  assert.equal(data.histogram["4"], 1800);
  assert.equal(data.histogram["3"], 100);
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
