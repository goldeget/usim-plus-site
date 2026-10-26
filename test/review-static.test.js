import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { decodeCursor } from "../functions/_lib/reviews.js";
import {
  DAILY_TODAY_COUNT,
  REVIEW_CHUNK_COUNT,
  REVIEW_SLOT_COUNT,
  comparePublishedDesc,
  displaySeoulDate,
  isTodaySlot,
  kstCalendarParts,
  kstClockParts,
  kstDateKey,
  presentReview,
  reviewDateMismatch,
  reviewIdForSlot,
  seoulDayIndex,
  todayWindowSlots
} from "../functions/_lib/review-dates.js";
import { getPublishedReview, queryPublishedReviews } from "../functions/_lib/review-static.js";
import { reviewAssetsEnv } from "../test-support/review-assets.js";

const seoulDateKey = kstDateKey;

const dataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/reviews/data");

async function readJson(rel) {
  return JSON.parse(await readFile(path.join(dataRoot, rel), "utf8"));
}

function seoulHour(date) {
  return kstClockParts(date).hour;
}

test("daily-50 window is stable within a Seoul day and changes the next day", () => {
  const morning = new Date("2026-10-26T15:00:00.000Z");
  const evening = new Date("2026-10-27T14:59:00.000Z");
  const nextMorning = new Date("2026-10-27T15:00:00.000Z");
  assert.equal(seoulDateKey(morning), "2026-10-27");
  assert.equal(seoulDateKey(evening), "2026-10-27");
  assert.equal(seoulDateKey(nextMorning), "2026-10-28");
  assert.equal(seoulDayIndex(morning), seoulDayIndex(evening));
  assert.notEqual(seoulDayIndex(morning), seoulDayIndex(nextMorning));

  const todaySlots = todayWindowSlots(morning);
  const again = todayWindowSlots(evening);
  const tomorrow = todayWindowSlots(nextMorning);
  assert.equal(todaySlots.length, DAILY_TODAY_COUNT);
  assert.equal(new Set(todaySlots).size, DAILY_TODAY_COUNT);
  assert.deepEqual(todaySlots, again);
  assert.notDeepEqual(todaySlots, tomorrow);
  assert.equal(tomorrow.length, DAILY_TODAY_COUNT);

  const overlap = todaySlots.filter(slot => tomorrow.includes(slot));
  assert.equal(overlap.length, DAILY_TODAY_COUNT - 1, "the window shifts by one slot");

  const base = new Date("2024-04-02T03:15:00.000Z");
  for (const slot of todaySlots) {
    assert.equal(isTodaySlot(slot, morning), true);
    const displayed = displaySeoulDate(slot, morning, base);
    assert.equal(seoulDateKey(displayed), "2026-10-27");
    assert.equal(seoulHour(displayed), seoulHour(base));
    const second = displaySeoulDate(slot, evening, base);
    assert.equal(second.toISOString(), displayed.toISOString());
  }
  for (let slot = 0; slot < REVIEW_SLOT_COUNT; slot += 100) {
    if (todaySlots.includes(slot)) continue;
    assert.equal(isTodaySlot(slot, morning), false);
    assert.equal(seoulDateKey(displaySeoulDate(slot, morning, base)), seoulDateKey(base));
  }
  assert.equal(todayWindowSlots(morning).filter(slot => isTodaySlot(slot, morning)).length, 50);
});

test("static corpus has 10000 reviews, average 4.8, and clean base dates", async () => {
  const meta = await readJson("meta.json");
  assert.equal(meta.count, 10_000);
  assert.equal(meta.avgRating, 4.8);
  assert.deepEqual(meta.histogram, { 1: 0, 2: 0, 3: 100, 4: 1800, 5: 8100 });
  assert.equal(meta.chunkCount, REVIEW_CHUNK_COUNT);

  let count = 0;
  let sum = 0;
  const hist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const seen = new Set();
  for (let chunk = 0; chunk < REVIEW_CHUNK_COUNT; chunk += 1) {
    const list = await readJson(`list/c${String(chunk).padStart(3, "0")}.json`);
    const bodies = await readJson(`bodies/c${String(chunk).padStart(3, "0")}.json`);
    assert.equal(list.items.length, 200);
    assert.equal(bodies.items.length, 200);
    const bodyBySlot = new Map(bodies.items.map(item => [item.slot, item.body]));
    for (const record of list.items) {
      count += 1;
      sum += record.rating;
      hist[record.rating] += 1;
      assert.equal(record.id, reviewIdForSlot(record.slot));
      assert.equal(seen.has(record.id), false);
      seen.add(record.id);
      assert.doesNotMatch(record.snippet, /corpus-\d{5}/i);
      assert.doesNotMatch(record.snippet, /\d+\s*분경/);
      assert.doesNotMatch(record.displayName, /corpus-/i);
      const body = bodyBySlot.get(record.slot);
      assert.equal(reviewDateMismatch(body, record.basePublishedAt), null, record.id);
      assert.doesNotMatch(body, /corpus-\d{5}/i);
      assert.doesNotMatch(body, /\d+\s*분경/);
    }
  }
  assert.equal(count, 10_000);
  assert.equal(Math.round((sum / count) * 10) / 10, 4.8);
  assert.deepEqual(hist, { 1: 0, 2: 0, 3: 100, 4: 1800, 5: 8100 });

  const rating3 = await readJson("rating-3.json");
  assert.equal(rating3.items.length, 100);
  assert.ok(rating3.items.every(item => item.rating === 3));
});

test("displayed Seoul date matches the phrase, including the 50 today slots", async () => {
  const meta = await readJson("meta.json");
  const later = new Date(new Date(meta.baseEnd).getTime() + 3 * 86_400_000);
  const laterKey = seoulDateKey(later);
  assert.notEqual(laterKey, seoulDateKey(meta.baseEnd));
  const env = reviewAssetsEnv();
  const request = new Request("https://climekr.com/api/reviews");

  const page = await queryPublishedReviews(env, request, { limit: 50, today: later });
  const again = await queryPublishedReviews(env, request, { limit: 50, today: later });
  assert.equal(page.items.length, 50);
  assert.deepEqual(page.items.map(item => item.id), again.items.map(item => item.id));
  for (const item of page.items) {
    assert.equal(seoulDateKey(item.publishedAt), laterKey, item.id);
    assert.doesNotMatch(item.snippet, /corpus-\d{5}/i);
    assert.doesNotMatch(item.snippet, /\d+\s*분경/);
  }
  const windowIds = new Set(todayWindowSlots(later).map(reviewIdForSlot));
  assert.deepEqual(new Set(page.items.map(item => item.id)), windowIds);

  const next = new Date(later.getTime() + 86_400_000);
  const nextPage = await queryPublishedReviews(env, request, { limit: 50, today: next });
  assert.equal(seoulDateKey(nextPage.items[0].publishedAt), seoulDateKey(next));
  assert.notDeepEqual(nextPage.items.map(item => item.id).sort(), page.items.map(item => item.id).sort());

  const older = await queryPublishedReviews(env, request, {
    limit: 1,
    today: later,
    cursor: decodeCursor(page.nextCursor)
  });
  assert.notEqual(seoulDateKey(older.items[0].publishedAt), laterKey);

  const samples = [page.items[0], page.items[17], page.items[49], older.items[0]];
  for (const item of samples) {
    const detail = await getPublishedReview(env, request, item.id, later);
    assert.equal(detail.publishedAt, item.publishedAt);
    assert.equal(reviewDateMismatch(detail.body, detail.publishedAt), null, item.id);
    assert.equal(detail.snippet, item.snippet);
    assert.doesNotMatch(detail.body, /corpus-\d{5}/i);
    assert.doesNotMatch(detail.body, /\d+\s*분경/);
    if (/\d{1,2}월\s*\d{1,2}일/.test(detail.snippet)) {
      const parts = kstCalendarParts(new Date(detail.publishedAt));
      assert.match(detail.snippet, new RegExp(`${parts.month}월\\s*${parts.day}일`), `${item.id} snippet`);
    }
  }
});

test("static reader order matches a full display-date sort", async () => {
  const meta = await readJson("meta.json");
  const today = new Date(new Date(meta.baseEnd).getTime() + 5 * 86_400_000);
  const records = [];
  for (let chunk = 0; chunk < REVIEW_CHUNK_COUNT; chunk += 1) {
    const list = await readJson(`list/c${String(chunk).padStart(3, "0")}.json`);
    records.push(...list.items);
  }
  const expected = records.map(record => presentReview(record, today)).sort(comparePublishedDesc);
  const env = reviewAssetsEnv();
  const request = new Request("https://climekr.com/api/reviews");
  const got = [];
  let cursor = null;
  do {
    const page = await queryPublishedReviews(env, request, { limit: 50, today, cursor });
    got.push(...page.items);
    cursor = page.nextCursor ? decodeCursor(page.nextCursor) : null;
  } while (cursor);
  assert.equal(got.length, expected.length);
  assert.deepEqual(got.map(item => item.id), expected.map(item => item.id));
  assert.deepEqual(got.map(item => item.publishedAt), expected.map(item => item.publishedAt));

  const threes = expected.filter(item => item.rating === 3);
  const ratingPage = await queryPublishedReviews(env, request, { limit: 20, rating: 3, today });
  assert.deepEqual(ratingPage.items.map(item => item.id), threes.slice(0, 20).map(item => item.id));
  const ratingRest = await queryPublishedReviews(env, request, {
    limit: 20,
    rating: 3,
    today,
    cursor: decodeCursor(ratingPage.nextCursor)
  });
  assert.deepEqual(ratingRest.items.map(item => item.id), threes.slice(20, 40).map(item => item.id));
  const empty = await queryPublishedReviews(env, request, { limit: 20, rating: 1, today });
  assert.deepEqual(empty.items, []);
  assert.equal(empty.nextCursor, null);
});

test("public review routes serve the static corpus without D1", async () => {
  const env = reviewAssetsEnv();
  const { onRequest: list } = await import("../functions/api/reviews/index.js");
  const { onRequest: stats } = await import("../functions/api/reviews/stats.js");
  const { onRequest: featured } = await import("../functions/api/reviews/featured.js");
  const { onRequest: detail } = await import("../functions/api/reviews/[id].js");

  const denied = await list({
    request: new Request("https://climekr.com/api/reviews", { method: "POST" }),
    env
  });
  assert.equal(denied.status, 405);

  const listRes = await list({
    request: new Request("https://climekr.com/api/reviews?limit=10"),
    env
  });
  assert.equal(listRes.status, 200);
  const listed = await listRes.json();
  assert.equal(listed.items.length, 10);
  assert.equal(seoulDateKey(listed.items[0].publishedAt), seoulDateKey(new Date()));
  for (let i = 1; i < listed.items.length; i += 1) {
    assert.ok(listed.items[i - 1].publishedAt >= listed.items[i].publishedAt);
    assert.doesNotMatch(listed.items[i].snippet, /corpus-\d{5}/i);
    assert.doesNotMatch(listed.items[i].snippet, /\d+\s*분경/);
  }

  const statsRes = await stats({
    request: new Request("https://climekr.com/api/reviews/stats"),
    env
  });
  assert.equal(statsRes.status, 200);
  assert.match(statsRes.headers.get("Cache-Control"), /s-maxage=300/);
  const statsBody = await statsRes.json();
  assert.equal(statsBody.total, 10_000);
  assert.equal(statsBody.avgRating, 4.8);

  const featuredRes = await featured({
    request: new Request("https://climekr.com/api/reviews/featured?limit=4"),
    env
  });
  assert.equal(featuredRes.status, 200);
  const featuredBody = await featuredRes.json();
  assert.equal(featuredBody.items.length, 4);
  assert.equal(seoulDateKey(featuredBody.items[0].publishedAt), seoulDateKey(new Date()));

  const detailRes = await detail({
    request: new Request(`https://climekr.com/api/reviews/${listed.items[0].id}`),
    env,
    params: { id: listed.items[0].id }
  });
  assert.equal(detailRes.status, 200);
  const detailBody = await detailRes.json();
  assert.equal(reviewDateMismatch(detailBody.body, detailBody.publishedAt), null);
  assert.equal(detailBody.publishedAt, listed.items[0].publishedAt);

  const missing = await detail({
    request: new Request("https://climekr.com/api/reviews/missing"),
    env,
    params: { id: "missing" }
  });
  assert.equal(missing.status, 404);
});
