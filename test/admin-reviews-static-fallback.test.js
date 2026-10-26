import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { createAdminEnvironment, createAdminSessionHeaders } from "../test-support/admin-auth.js";
import { extendReviewsDb } from "../test-support/reviews-db.js";
import { reviewAssetsBinding } from "../test-support/review-assets.js";
import { insertReviewRecord, rebuildReviewStats } from "../functions/_lib/reviews.js";

/**
 * 어드민 후기 화면 정적 코퍼스 폴백: D1이 비어 있거나 읽기에 실패하면
 * GET /api/admin/reviews* 가 ASSETS의 public/reviews/data/** 로 응답해야 한다.
 */
async function adminEnv({ seedReview = false, breakReviewsRead = false } = {}) {
  const store = createMemoryCloudflare();
  extendReviewsDb(store.CONTENT_DB, store.APPLICATIONS_BUCKET);
  const env = createAdminEnvironment({ cloudflare: store, email: "admin@example.test" });
  env.ASSETS = reviewAssetsBinding();
  if (seedReview) {
    const body = "유심 개통 상담 과정이 차분하게 안내되어 이해하기 쉬웠습니다. " + "가".repeat(30);
    const inserted = await insertReviewRecord({
      db: env.CONTENT_DB,
      bucket: env.APPLICATIONS_BUCKET,
      record: { body, rating: 5, displayName: "관리자테스트", source: "test", sourceRowId: "1" }
    });
    assert.equal(inserted.ok, true);
    await rebuildReviewStats(env.CONTENT_DB);
    env.seededReviewId = inserted.id;
  }
  if (breakReviewsRead) {
    const originalPrepare = env.CONTENT_DB.prepare.bind(env.CONTENT_DB);
    env.CONTENT_DB.prepare = sql => {
      if (/FROM reviews/i.test(sql)) {
        const fail = async () => { throw new Error("injected D1 read failure"); };
        return { bind: () => ({ all: fail, first: fail, run: fail }), all: fail, first: fail, run: fail };
      }
      return originalPrepare(sql);
    };
  }
  env.adminHeaders = await createAdminSessionHeaders(env);
  return env;
}

async function callAdminReviewList(env, params = {}, headers = env.adminHeaders) {
  const { onRequest } = await import("../functions/api/admin/reviews/index.js");
  const query = new URLSearchParams(params);
  return onRequest({
    request: new Request(`https://admin.climekr.com/api/admin/reviews${query.size ? `?${query}` : ""}`, { headers }),
    env
  });
}

async function callAdminReviewDetail(env, id, headers = env.adminHeaders) {
  const { onRequest } = await import("../functions/api/admin/reviews/[id].js");
  return onRequest({
    request: new Request(`https://admin.climekr.com/api/admin/reviews/${encodeURIComponent(id)}`, { headers }),
    env,
    params: { id }
  });
}

test("empty D1 falls back to the static corpus with the admin list shape", async () => {
  const env = await adminEnv();
  const response = await callAdminReviewList(env, { limit: "10" });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.items.length, 10);
  assert.equal(data.totalPublished, 10_000);
  assert.ok(data.nextCursor, "corpus has more pages");
  for (const item of data.items) {
    assert.equal(item.status, "published");
    assert.equal(item.source, "corpus_v1");
    assert.match(item.id, /^rv\d{4}$/);
    assert.ok(item.snippet.length > 0);
  }
  for (let i = 1; i < data.items.length; i += 1) {
    assert.ok(data.items[i - 1].publishedAt >= data.items[i].publishedAt, "newest first");
  }
});

test("non-published status filters fall back to an empty list", async () => {
  const env = await adminEnv();
  for (const status of ["draft", "hidden"]) {
    const response = await callAdminReviewList(env, { status });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.items, []);
    assert.equal(data.nextCursor, null);
  }
});

test("rating filter and cursor pagination work against the corpus", async () => {
  const env = await adminEnv();
  const first = await (await callAdminReviewList(env, { limit: "5", rating: "5" })).json();
  assert.equal(first.items.length, 5);
  assert.ok(first.items.every(item => item.rating === 5));
  const secondRes = await callAdminReviewList(env, { limit: "5", rating: "5", cursor: first.nextCursor });
  assert.equal(secondRes.status, 200);
  const second = await secondRes.json();
  assert.equal(second.items.length, 5);
  const firstIds = new Set(first.items.map(item => item.id));
  assert.ok(second.items.every(item => !firstIds.has(item.id)), "pages do not overlap");
});

test("a D1 read failure also falls back to the static corpus", async () => {
  const env = await adminEnv({ breakReviewsRead: true });
  const response = await callAdminReviewList(env, { limit: "5" });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.items.length, 5);
  assert.equal(data.totalPublished, 10_000);
  assert.ok(data.items.every(item => item.source === "corpus_v1"));
});

test("seeded D1 rows take priority over the corpus", async () => {
  const env = await adminEnv({ seedReview: true });
  const response = await callAdminReviewList(env);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].id, env.seededReviewId);
  assert.equal(data.items[0].source, "test");
  assert.equal(data.totalPublished, 1);
});

test("detail falls back to the static corpus and includes the body", async () => {
  const env = await adminEnv();
  const list = await (await callAdminReviewList(env, { limit: "1" })).json();
  const id = list.items[0].id;
  const response = await callAdminReviewDetail(env, id);
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.equal(detail.id, id);
  assert.equal(detail.status, "published");
  assert.equal(detail.source, "corpus_v1");
  assert.ok(typeof detail.body === "string" && detail.body.length > 0);
});

test("detail serves a seeded D1 row with its R2 body when present", async () => {
  const env = await adminEnv({ seedReview: true });
  const response = await callAdminReviewDetail(env, env.seededReviewId);
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.equal(detail.id, env.seededReviewId);
  assert.equal(detail.source, "test");
  assert.match(detail.body, /차분하게 안내되어/);
});

test("detail returns 404 for an id outside both stores", async () => {
  const env = await adminEnv();
  const response = await callAdminReviewDetail(env, "not-a-corpus-id");
  assert.equal(response.status, 404);
});

test("the fallback still requires an admin session", async () => {
  const env = await adminEnv();
  assert.equal((await callAdminReviewList(env, {}, {})).status, 401);
  assert.equal((await callAdminReviewDetail(env, "rv0001", {})).status, 401);
});
