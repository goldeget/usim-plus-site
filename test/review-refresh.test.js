import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { generateReviewRows } from "../scripts/generate-review-rows.mjs";
import {
  DAILY_REVIEW_REFRESH_LIMIT,
  kstCalendarParts,
  kstDateKey,
  refreshPublishedReviews,
  rewriteReviewDatePhrase
} from "../functions/_lib/review-refresh.js";
import { reviewHashes } from "../functions/_lib/reviews.js";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";

function assertBodyMatchesKst(body, when) {
  const cal = kstCalendarParts(when instanceof Date ? when : new Date(when));
  assert.match(body, new RegExp(`${cal.month}월\\s*${cal.day}일`));
  assert.doesNotMatch(body, /\d+\s*분경/);
  assert.doesNotMatch(body, /corpus-/i);
  for (const match of body.matchAll(/(\d{4})년/g)) {
    assert.equal(Number(match[1]), cal.year);
  }
  for (const match of body.matchAll(/(\d{1,2})월\s*(\d{1,2})일/g)) {
    assert.equal(Number(match[1]), cal.month);
    assert.equal(Number(match[2]), cal.day);
  }
  for (const match of body.matchAll(/(일|월|화|수|목|금|토)요일/g)) {
    assert.equal(match[1], cal.weekday);
  }
  return cal;
}

function stripCalendar(text) {
  return String(text)
    .replace(/\d{4}\s*년\s*/g, "")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, "")
    .replace(/(?:일|월|화|수|목|금|토)요일/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createHarness() {
  const store = createMemoryCloudflare();
  const reviews = new Map();
  const days = new Map();

  function changes(n) {
    return { meta: { changes: n } };
  }

  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (/SELECT refreshed_count FROM review_refresh_days/i.test(sql)) {
                const row = days.get(values[0]);
                return row ? { refreshed_count: row.refreshed_count } : null;
              }
              if (/SELECT id FROM reviews/i.test(sql) && /body_sha256 = \?/i.test(sql)) {
                const [id, bodySha, normSha, snippetSha] = values;
                const hit = [...reviews.values()].find(row =>
                  row.id !== id &&
                  (row.body_sha256 === bodySha || row.body_norm_sha256 === normSha || row.snippet_sha256 === snippetSha)
                );
                return hit ? { id: hit.id } : null;
              }
              throw new Error(`unexpected first(): ${sql}`);
            },
            async all() {
              if (/FROM reviews/i.test(sql) && /ORDER BY published_at ASC/i.test(sql)) {
                const [kstDate, cursorPublishedAt, , cursorId, pageSize] = values;
                const results = [...reviews.values()]
                  .filter(row => row.status === "published")
                  .filter(row => row.refreshed_on == null || row.refreshed_on !== kstDate)
                  .filter(row => row.published_at > cursorPublishedAt || (row.published_at === cursorPublishedAt && row.id > cursorId))
                  .sort((a, b) => a.published_at.localeCompare(b.published_at) || a.id.localeCompare(b.id))
                  .slice(0, pageSize)
                  .map(row => ({ ...row }));
                return { results };
              }
              throw new Error(`unexpected all(): ${sql}`);
            },
            async run() {
              if (/INSERT INTO review_refresh_days/i.test(sql)) {
                const [kstDate, updatedAt] = values;
                if (!days.has(kstDate)) days.set(kstDate, { refreshed_count: 0, updated_at: updatedAt });
                return changes(days.get(kstDate).refreshed_count === 0 ? 1 : 0);
              }
              if (/UPDATE review_refresh_days/i.test(sql)) {
                const [updatedAt, kstDate, limit] = values;
                const row = days.get(kstDate);
                if (!row || row.refreshed_count >= limit) return changes(0);
                row.refreshed_count += 1;
                row.updated_at = updatedAt;
                return changes(1);
              }
              if (/UPDATE reviews SET/i.test(sql)) {
                const [
                  published_at, snippet, snippet_sha256, body_sha256, body_norm_sha256,
                  body_byte_length, refreshed_on, updated_at, id, kstGuard
                ] = values;
                const row = reviews.get(id);
                const guarded = /status = 'published'/i.test(sql);
                if (!row) return changes(0);
                if (guarded) {
                  if (row.status !== "published") return changes(0);
                  if (row.refreshed_on != null && row.refreshed_on === kstGuard) return changes(0);
                  const clash = [...reviews.values()].find(other =>
                    other.id !== id &&
                    (other.body_sha256 === body_sha256 || other.body_norm_sha256 === body_norm_sha256 || other.snippet_sha256 === snippet_sha256)
                  );
                  if (clash) throw new Error("UNIQUE constraint failed: reviews.body_sha256");
                }
                Object.assign(row, {
                  published_at,
                  snippet,
                  snippet_sha256,
                  body_sha256,
                  body_norm_sha256,
                  body_byte_length,
                  refreshed_on,
                  updated_at
                });
                return changes(1);
              }
              throw new Error(`unexpected run(): ${sql}`);
            }
          };
        }
      };
    }
  };

  return { db, bucket: store.APPLICATIONS_BUCKET, reviews, days };
}

async function readStoredBody(bucket, key) {
  const object = await bucket.get(key);
  assert.ok(object, `missing R2 object ${key}`);
  return JSON.parse(await new Response(object.body).text());
}

async function seedReview(h, i, { status = "published", body, publishedAt, withObject = true, rating } = {}) {
  const id = `r${String(i).padStart(4, "0")}`;
  const text = body || `${(i % 9) + 1}월 ${(i % 27) + 1}일 12분경 오전에 유심 플랫폼 상담을 남겼습니다. 사례 ${id}번은 사진만 보냈고 이용자 부담은 0원이었습니다. 안내가 차분했습니다.`;
  const at = publishedAt || new Date(Date.UTC(2021, 0, 1) + i * 86400000).toISOString();
  const stars = rating || ((i % 3) + 3);
  const hashes = await reviewHashes(text);
  const key = `reviews/bodies/${id}.json`;
  h.reviews.set(id, {
    id,
    published_at: at,
    rating: stars,
    snippet: hashes.snippet,
    snippet_sha256: hashes.snippet_sha256,
    body_sha256: hashes.body_sha256,
    body_norm_sha256: hashes.body_norm_sha256,
    body_byte_length: hashes.body_byte_length,
    body_r2_key: key,
    display_name: "김*희",
    status,
    featured: i > 0 && i <= 2 ? 1 : 0,
    sort_boost: i > 0 && i <= 2 ? 100 - i : 0,
    refreshed_on: null,
    updated_at: at
  });
  if (withObject) {
    await h.bucket.put(key, JSON.stringify({
      id,
      body: text,
      rating: stars,
      publishedAt: at,
      importedAt: at
    }), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  }
  return id;
}

test("date phrase rewrite matches the KST calendar date and drops minute stamps", () => {
  const when = new Date("2026-05-04T03:00:00.000Z");
  const rewritten = rewriteReviewDatePhrase(
    "2023년 12월 20일 화요일 12분경 오전에 상담했습니다. 5월 4일은 예시이고 3일 유지 조건을 확인했습니다.",
    when
  );
  const cal = assertBodyMatchesKst(rewritten, when);
  assert.match(rewritten, new RegExp(`${cal.year}년 ${cal.month}월 ${cal.day}일`));
  assert.match(rewritten, /오전에/);
  assert.match(rewritten, /3일 유지/);
  assert.doesNotMatch(rewritten, /2023/);
  assert.doesNotMatch(rewritten, /12월/);
  assert.doesNotMatch(rewritten, /20일/);

  const [row] = generateReviewRows(1);
  const corpus = rewriteReviewDatePhrase(row.body, when);
  assert.equal(corpus, row.body);
  assert.doesNotMatch(corpus, /\d{1,2}\s*월\s*\d{1,2}\s*일/);
  assert.equal(stripCalendar(corpus), stripCalendar(row.body));
  assert.equal(DAILY_REVIEW_REFRESH_LIMIT, 50);
});

test("daily refresh updates 50 distinct oldest reviews once per Seoul day", async () => {
  const h = createHarness();
  await seedReview(h, 0, {
    status: "hidden",
    publishedAt: "2020-01-01T00:00:00.000Z",
    body: "1월 1일 12분경 숨김 후기입니다. 사진만 보냈고 이용자 부담은 0원이었습니다. 이 글은 게시 중이 아닙니다."
  });
  const ids = [];
  for (let i = 1; i <= 60; i += 1) ids.push(await seedReview(h, i));
  const before = new Map([...h.reviews.entries()].map(([id, row]) => [id, {
    rating: row.rating,
    featured: row.featured,
    sort_boost: row.sort_boost,
    display_name: row.display_name,
    published_at: row.published_at
  }]));
  const totalBefore = h.reviews.size;

  const when = new Date("2026-10-26T02:10:00.000Z");
  const first = await refreshPublishedReviews({ db: h.db, bucket: h.bucket, now: when });
  assert.equal(first.updated, 50);
  assert.equal(first.ids.length, 50);
  assert.equal(new Set(first.ids).size, 50);
  assert.deepEqual(first.ids, ids.slice(0, 50));
  assert.equal(first.kstDate, kstDateKey(when));
  assert.equal(h.reviews.size, totalBefore);

  for (const id of first.ids) {
    const row = h.reviews.get(id);
    const prior = before.get(id);
    assert.equal(row.published_at, when.toISOString());
    assert.equal(row.refreshed_on, first.kstDate);
    assert.equal(row.rating, prior.rating);
    assert.equal(row.featured, prior.featured);
    assert.equal(row.sort_boost, prior.sort_boost);
    assert.equal(row.display_name, prior.display_name);
    const stored = await readStoredBody(h.bucket, row.body_r2_key);
    assert.equal(stored.body.length >= 40, true);
    assert.equal(stored.rating, prior.rating);
    assert.equal(stored.publishedAt, when.toISOString());
    assertBodyMatchesKst(stored.body, when);
    assert.doesNotMatch(stored.body, /12분경/);
    const hashes = await reviewHashes(stored.body);
    assert.equal(row.snippet, hashes.snippet);
    assert.equal(row.snippet_sha256, hashes.snippet_sha256);
    assert.equal(row.body_sha256, hashes.body_sha256);
    assert.equal(row.body_norm_sha256, hashes.body_norm_sha256);
  }

  for (const id of ids.slice(50)) {
    const row = h.reviews.get(id);
    assert.equal(row.published_at, before.get(id).published_at);
    assert.equal(row.refreshed_on, null);
    const stored = await readStoredBody(h.bucket, row.body_r2_key);
    assert.match(stored.body, /12분경/);
  }
  const hidden = h.reviews.get("r0000");
  assert.equal(hidden.status, "hidden");
  assert.equal(hidden.published_at, before.get("r0000").published_at);
  assert.equal(hidden.refreshed_on, null);

  const published = [...h.reviews.values()].filter(row => row.status === "published");
  published.sort((a, b) => b.published_at.localeCompare(a.published_at) || (a.id < b.id ? 1 : -1));
  assert.deepEqual(published.slice(0, 50).map(row => row.id).sort(), [...first.ids].sort());

  const second = await refreshPublishedReviews({ db: h.db, bucket: h.bucket, now: when });
  assert.equal(second.updated, 0);
  assert.deepEqual(second.ids, []);
  for (const id of ids.slice(50)) {
    assert.equal(h.reviews.get(id).published_at, before.get(id).published_at);
  }
  assert.equal(h.days.get(first.kstDate).refreshed_count, 50);
});

test("skips a uniqueness conflict and refreshes the next published review", async () => {
  const h = createHarness();
  const tail = "오전에 유심 플랫폼 상담을 남겼습니다. 사진만 보냈고 이용자 부담은 0원이었습니다.";
  const older = await seedReview(h, 1, {
    publishedAt: "2022-01-01T00:00:00.000Z",
    body: `3월 1일 ${tail}`
  });
  const clash = await seedReview(h, 2, {
    publishedAt: "2022-01-02T00:00:00.000Z",
    body: `8월 9일 12분경 ${tail}`
  });
  const next = await seedReview(h, 3, {
    publishedAt: "2022-01-03T00:00:00.000Z",
    body: `2월 2일 ${tail} 이 후기만 다른 문장으로 남깁니다.`
  });
  const blocked = await seedReview(h, 4, {
    publishedAt: "2022-01-04T00:00:00.000Z",
    body: "corpus-00042 가 본문에 들어간 후기는 날짜를 다시 쓰지 않습니다. 사진만 보냈고 이용자 부담은 0원이었습니다."
  });
  const when = new Date("2026-10-26T02:10:00.000Z");
  const result = await refreshPublishedReviews({ db: h.db, bucket: h.bucket, now: when });
  assert.deepEqual(result.ids, [older, next]);
  assert.equal(h.reviews.get(clash).published_at, "2022-01-02T00:00:00.000Z");
  assert.equal(h.reviews.get(clash).refreshed_on, null);
  const skippedBody = await readStoredBody(h.bucket, h.reviews.get(clash).body_r2_key);
  assert.match(skippedBody.body, /12분경/);
  assert.match(skippedBody.body, /8월 9일/);
  const kept = await readStoredBody(h.bucket, h.reviews.get(blocked).body_r2_key);
  assert.match(kept.body, /corpus-00042/);
  assert.equal(h.reviews.get(blocked).refreshed_on, null);
  const refreshed = await readStoredBody(h.bucket, h.reviews.get(older).body_r2_key);
  assertBodyMatchesKst(refreshed.body, when);
  assert.doesNotMatch(refreshed.body, /corpus-/i);
});

test("fewer than 50 published reviews refreshes only those rows and a second run updates 0", async () => {
  const h = createHarness();
  for (let i = 1; i <= 7; i += 1) await seedReview(h, i);
  const when = new Date("2026-11-02T01:00:00.000Z");
  const first = await refreshPublishedReviews({ db: h.db, bucket: h.bucket, now: when });
  assert.equal(first.updated, 7);
  assert.equal(new Set(first.ids).size, 7);
  const second = await refreshPublishedReviews({ db: h.db, bucket: h.bucket, now: when });
  assert.equal(second.updated, 0);
  const empty = await refreshPublishedReviews({ db: createHarness().db, bucket: createHarness().bucket, now: when });
  assert.equal(empty.updated, 0);
});

test("scheduled worker refreshes eligible reviews once and the operator copy stays plain Korean", async () => {
  const h = createHarness();
  await seedReview(h, 1);
  await seedReview(h, 2);
  const worker = (await import("../review-refresh-worker.js")).default;
  await worker.scheduled({}, {}, {});
  const started = new Date();
  await worker.scheduled({}, { CONTENT_DB: h.db, APPLICATIONS_BUCKET: h.bucket }, {});
  const finished = new Date();
  const keys = new Set([kstDateKey(started), kstDateKey(finished)]);
  for (const row of h.reviews.values()) {
    assert.ok(keys.has(row.refreshed_on));
    const stored = await readStoredBody(h.bucket, row.body_r2_key);
    assert.doesNotMatch(stored.body, /분경/);
    assertBodyMatchesKst(stored.body, row.published_at);
  }
  const stamped = [...h.reviews.values()].map(row => row.published_at);
  await worker.scheduled({}, { CONTENT_DB: h.db, APPLICATIONS_BUCKET: h.bucket }, {});
  assert.deepEqual([...h.reviews.values()].map(row => row.published_at), stamped);

  const config = await readFile(new URL("../wrangler-review-refresh.toml", import.meta.url), "utf8");
  assert.match(config, /crons = \["10 15 \* \* \*"\]/);
  assert.match(config, /database_id = "23f98117-e3e7-4804-9d72-c8f15d812aa7"/);
  assert.match(config, /bucket_name = "usim-plus-applications"/);
  assert.match(config, /usim-plus-review-refresh/);
  const admin = await readFile(new URL("../public/admin/reviews.html", import.meta.url), "utf8");
  assert.match(admin, /매일 자동으로 50건의 날짜가 오늘로 맞춰집니다\./);
});
