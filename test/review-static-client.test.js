import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { decodeCursor, encodeCursor } from "../functions/_lib/reviews.js";
import { getPublishedReview, getReviewStats, queryPublishedReviews } from "../functions/_lib/review-static.js";
import {
  createReviewCorpus,
  decodeCursor as staticDecode,
  encodeCursor as staticEncode
} from "../public/reviews/review-corpus.js";
import { reviewAssetsEnv } from "../test-support/review-assets.js";

const dataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/reviews/data");

async function readJson(pathname) {
  const rel = pathname.replace(/^\/reviews\/data\//, "");
  return JSON.parse(await readFile(path.join(dataRoot, rel), "utf8"));
}

test("browser review dates stay identical to the function module", async () => {
  const server = await readFile(new URL("../functions/_lib/review-dates.js", import.meta.url), "utf8");
  const browser = await readFile(new URL("../public/reviews/review-dates.js", import.meta.url), "utf8");
  assert.equal(browser, server);
});

test("static cursor codec matches the API cursor codec", () => {
  const encoded = encodeCursor("2026-10-28T00:00:00.000Z", "rv1234");
  assert.equal(staticEncode("2026-10-28T00:00:00.000Z", "rv1234"), encoded);
  assert.deepEqual(staticDecode(encoded), decodeCursor(encoded));
  assert.equal(staticDecode(""), null);
});

test("filesystem corpus matches the Pages review reader", async () => {
  const today = new Date("2026-10-27T21:00:00.000Z");
  const env = reviewAssetsEnv();
  const request = new Request("https://climekr.com/api/reviews");
  const corpus = createReviewCorpus();

  const page = await queryPublishedReviews(env, request, { limit: 10, today });
  const viaFiles = await corpus.queryPublishedReviews(readJson, { limit: 10, today });
  assert.equal(page.items.length, 10);
  assert.deepEqual(viaFiles, page);
  assert.ok(page.items.every(item => item.snippet && item.displayName));

  const next = await queryPublishedReviews(env, request, {
    limit: 10,
    today,
    cursor: decodeCursor(page.nextCursor)
  });
  const viaFilesNext = await corpus.queryPublishedReviews(readJson, {
    limit: 10,
    today,
    cursor: staticDecode(page.nextCursor)
  });
  assert.deepEqual(viaFilesNext, next);
  assert.notEqual(next.items[0].id, page.items[0].id);

  const stats = await getReviewStats(env, request);
  assert.deepEqual(await corpus.getReviewStats(readJson), stats);
  assert.equal(stats.total, 10_000);

  const detail = await getPublishedReview(env, request, page.items[0].id, today);
  const fileDetail = await corpus.getPublishedReview(readJson, page.items[0].id, today);
  assert.equal(typeof fileDetail.body, "string");
  assert.ok(fileDetail.body.length > 40);
  assert.deepEqual(fileDetail, detail);

  const rated = await queryPublishedReviews(env, request, { limit: 5, rating: 3, today });
  const fileRated = await corpus.queryPublishedReviews(readJson, { limit: 5, rating: 3, today });
  assert.deepEqual(fileRated, rated);
  assert.ok(rated.items.every(item => item.rating === 3));
});

test("public pages fall back to static JSON only when the reviews API is not JSON", async () => {
  const reviewsJs = await readFile(new URL("../public/reviews/reviews.js", import.meta.url), "utf8");
  const home = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(reviewsJs, /\/reviews\/static-fallback\.js/);
  assert.match(reviewsJs, /후기 목록을 불러오지 못했습니다/);
  assert.match(reviewsJs, /후기 집계를 불러오지 못했습니다/);
  assert.match(reviewsJs, /api\.failed/);
  assert.match(home, /\/reviews\/static-fallback\.js/);
  assert.match(home, /loadStaticHome\(4\)/);
  assert.match(home, /statsApi\.failed\|\|featApi\.failed/);
});
