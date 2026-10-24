import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { createAdminEnvironment, createAdminSessionHeaders } from "../test-support/admin-auth.js";

test("bounds authenticated CMS writes when Content-Length is missing", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  let cancelled = false;
  let closeTimer;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(36001));
      closeTimer = setTimeout(() => controller.close(), 50);
    },
    cancel() { cancelled = true; clearTimeout(closeTimer); }
  });
  const request = new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: {
      ...sessionHeaders,
      "Content-Type": "application/json",
      origin: "https://admin.climekr.com"
    },
    body: stream,
    duplex: "half"
  });
  const response = await onRequest({ request, env });
  assert.equal(request.headers.has("content-length"), false);
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
});

test("accepts three CMS steps and the existing character limit with Korean UTF-8 text", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const content = {
    headline: "가".repeat(100),
    intro: "나".repeat(500),
    checklist: Array.from({ length: 3 }, () => ({ title: "다".repeat(80), body: "라".repeat(300) })),
    faqs: Array.from({ length: 10 }, () => ({ question: "마".repeat(160), answer: "바".repeat(400) }))
  };
  const body = JSON.stringify(content);
  assert.ok(body.length <= 12000);
  assert.ok(Buffer.byteLength(body) > 20000);
  const request = new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: {
      ...sessionHeaders,
      "Content-Type": "application/json",
      origin: "https://admin.climekr.com"
    },
    body
  });
  const response = await onRequest({ request, env });
  assert.equal(response.status, 200);
});

test("rejects CMS content that changes the three-step user journey", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const base = {
    schemaVersion: 2,
    headline: "클라임유심 안내",
    intro: "현재 개통 현황을 확인하세요.",
    checklist: [{ title: "개통 현황 조회", body: "KAIT에서 확인합니다." }, { title: "사진 제출", body: "확인 화면을 첨부합니다." }, { title: "상태 조회", body: "접수번호로 확인합니다." }],
    faqs: [{ question: "누가 확인하나요?", answer: "운영자가 확인합니다." }]
  };
  for (const checklist of [base.checklist.slice(0, 2), [...base.checklist, { title: "추가 단계", body: "추가 설명" }]]) {
    const response = await onRequest({
      request: new Request("https://admin.climekr.com/api/content", {
        method: "PUT",
        headers: { ...sessionHeaders, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, checklist })
      }),
      env
    });
    assert.equal(response.status, 400);
  }
});

test("returns a clear unavailable response when the bound D1 content table cannot be read", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  env.CONTENT_DB = { prepare: () => ({ bind: () => ({ first: async () => { throw new Error("missing table"); } }) }) };
  const response = await onRequest({ request: new Request("https://climekr.com/api/content"), env });
  const data = await response.json();
  assert.equal(response.status, 503);
  assert.equal(data.cmsReady, false);
  assert.match(data.error, /저장소/);
});

test("keeps legacy editor content out of the current homepage while showing versioned defaults", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const cloudflare = createMemoryCloudflare();
  const legacy = {
    headline: "유심 가입 전, 조건부터 확인하세요.",
    intro: "이전 일반 가입 안내 문구입니다.",
    checklist: [{ title: "이전 항목", body: "이전 설명" }],
    faqs: [{ question: "이전 질문인가요?", answer: "이전 답변입니다." }]
  };
  cloudflare.siteContent.set("home", { id: "home", content: JSON.stringify(legacy), updated_at: "2026-10-24T00:00:00.000Z" });
  const env = createAdminEnvironment({ cloudflare });
  const response = await onRequest({ request: new Request("https://climekr.com/api/content"), env });
  const data = await response.json();

  assert.equal(data.schemaVersion, 2);
  assert.equal(data.legacyContent, true);
  assert.equal(data.headline, "유심 개통하면\n최대 51만원");
  assert.equal(data.intro, "개통 전 참여 조건과 통신사 요금·약정을 먼저 확인하세요. 참여를 원하면 개통 후 현황 사진으로 신청하세요.");
  assert.deepEqual(data.checklist.map(step => step.title), ["1. 개통 전 조건 확인", "2. 개통 후 사진 신청", "3. 유지 조건 확인 후 지급"]);
  assert.match(data.checklist[0].body, /개통 전에 지급 조건과 통신사 공식 안내의 요금/);
  assert.match(data.checklist[1].body, /개통한 뒤.*개통 현황.*사진/);
  assert.equal(cloudflare.siteContent.get("home").content, JSON.stringify(legacy));
});

test("archives legacy homepage copy before saving the current editable content", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const cloudflare = createMemoryCloudflare();
  const legacy = { headline: "이전 제목", intro: "이전 문구", checklist: [], faqs: [] };
  cloudflare.siteContent.set("home", { id: "home", content: JSON.stringify(legacy), updated_at: "2026-10-24T00:00:00.000Z" });
  const env = createAdminEnvironment({ cloudflare });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const content = {
    schemaVersion: 2,
    headline: "클라임유심 안내",
    intro: "현재 홈페이지 첫 안내입니다.",
    checklist: [
      { title: "1. 개통 현황 확인", body: "KAIT 공식 조회를 이용하세요." },
      { title: "2. 사진 사전 검토 신청", body: "확인 화면을 첨부하세요." },
      { title: "3. 접수번호로 결과 확인", body: "접수번호로 확인하세요." }
    ],
    faqs: [{ question: "사진은 누가 확인하나요?", answer: "로그인한 운영자가 확인합니다." }]
  };
  const response = await onRequest({
    request: new Request("https://admin.climekr.com/api/content", {
      method: "PUT",
      headers: { ...sessionHeaders, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
      body: JSON.stringify(content)
    }),
    env
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.content.schemaVersion, 2);
  assert.equal(JSON.parse(cloudflare.siteContent.get("home").content).headline, content.headline);
  assert.equal(JSON.parse(cloudflare.siteContent.get("home_legacy").content).headline, legacy.headline);
});
