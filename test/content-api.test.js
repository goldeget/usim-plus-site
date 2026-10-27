import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { createAdminEnvironment, createAdminSessionHeaders } from "../test-support/admin-auth.js";
import { DEFAULT_CONTENT } from "../functions/api/content.js";

const freshContent = () => structuredClone(DEFAULT_CONTENT);

test("bounds authenticated CMS writes when Content-Length is missing", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  let cancelled = false;
  let closeTimer;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(160001));
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

test("accepts a fully filled CMS document within its bounded UTF-8 request limit", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const content = freshContent();
  content.headline = "가".repeat(100);
  content.intro = "나".repeat(500);
  content.checklist = Array.from({ length: 3 }, () => ({ title: "다".repeat(80), body: "라".repeat(300) }));
  content.faqs = Array.from({ length: 10 }, () => ({ question: "마".repeat(160), answer: "바".repeat(400) }));
  content.faqs[0].key = "payoutSchedule";
  content.copy = Object.fromEntries(Object.keys(content.copy).map(key => [key, "사".repeat(500)]));
  content.seo = { title: "검색 제목 {{MAX_TOTAL}}", description: "아".repeat(500), socialTitle: "공유 제목 {{MAX_TOTAL}}", socialDescription: "자".repeat(500) };
  const body = JSON.stringify(content);
  assert.ok(Buffer.byteLength(body) > 36000);
  assert.ok(Buffer.byteLength(body) < 160000);
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

test("keeps factual privacy notices fixed to the actual data handling", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const cloudflare = createMemoryCloudflare();
  const env = createAdminEnvironment({ cloudflare });
  const headers = await createAdminSessionHeaders(env);
  const content = freshContent();
  for (const key of ["privacyCollection", "privacyPurpose", "privacyStorage", "privacyConsent", "privacyProvider"]) {
    content.copy[key] = "실제 운영과 다른 문구";
  }
  const response = await onRequest({ request: new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
    body: JSON.stringify(content)
  }), env });
  const data = await response.json();
  assert.equal(response.status, 200);
  for (const key of ["privacyCollection", "privacyPurpose", "privacyStorage", "privacyConsent", "privacyProvider"]) {
    assert.equal(data.content.copy[key], DEFAULT_CONTENT.copy[key], key);
  }
  assert.doesNotMatch(cloudflare.siteContent.get("home").content, /실제 운영과 다른 문구/);
});

test("requires the displayed total payout in the headline and search titles to match payout settings", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const content = freshContent();
  content.headline = "유심 개통 가능하면 최대 51만원";
  content.seo.title = "클라임유심 최대 51만원";
  content.seo.socialTitle = "클라임유심 최대 51만원";
  content.seo.description = "검색 안내: 총 최대 51만원";
  content.seo.socialDescription = "공유 안내: 총 최대 51만원";
  content.intro = "현재 총 최대 51만원을 안내합니다.";
  content.faqs[0].answer = "3일 유지 후 5만원을 받습니다.";
  content.payout.milestones[0].amount = 60000;
  const response = await onRequest({ request: new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
    body: JSON.stringify(content)
  }), env });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /총액/);
});

test("rejects outdated payout days in any editable public copy", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const content = freshContent();
  content.payout.milestones[0].days = 5;
  content.copy.contactIntro = "3일 유지 후 상담해 주세요.";
  const response = await onRequest({ request: new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
    body: JSON.stringify(content)
  }), env });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /유지 일수/);
});

test("rejects a valid amount when it is assigned to the wrong retention milestone", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const content = freshContent();
  content.payout.milestones[0].amount = 60000;
  content.faqs[0].answer = "3일 유지 후 5만원을 지급합니다.";
  const response = await onRequest({ request: new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
    body: JSON.stringify(content)
  }), env });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /지급 금액이 현재 기준과 다릅니다|서로 맞지 않습니다/);
});

test("rejects stale payout amounts in the generated payout FAQ question", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const content = freshContent();
  content.payout.milestones = [
    { days: 3, amount: 60000 },
    { days: 15, amount: 40000 },
    { days: 30, amount: 50000 }
  ];
  content.faqs.find(item => item.key === "payoutSchedule").question = "최대 51만원 받을 수 있나요?";
  const response = await onRequest({ request: new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
    body: JSON.stringify(content)
  }), env });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /현재 기준과 다릅니다/);
});

test("rejects payout amount lists that do not match their retention-day order", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const content = freshContent();
  content.faqs[0].answer = "유지 기간은 3일, 15일, 30일입니다. 지급 기준과 신청 절차를 확인하고 상담을 진행합니다. 단계별 지급 금액은 7만원, 5만원, 5만원입니다.";
  const response = await onRequest({ request: new Request("https://admin.climekr.com/api/content", {
    method: "PUT",
    headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
    body: JSON.stringify(content)
  }), env });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /서로 맞지 않습니다/);
});

test("clears the public homepage edge cache after publishing content", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "caches");
  let deletedUrl = "";
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { default: { delete: async request => { deletedUrl = request.url; return true; } } }
  });
  try {
    const response = await onRequest({ request: new Request("https://admin.climekr.com/api/content", {
      method: "PUT",
      headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
      body: JSON.stringify(freshContent())
    }), env });
    assert.equal(response.status, 200);
    assert.equal(deletedUrl, "https://climekr.com/");
  } finally {
    if (previous) Object.defineProperty(globalThis, "caches", previous);
    else delete globalThis.caches;
  }
});

test("saves consultation links in the admin CMS and returns them to the public page", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const supportLinks = {
    telegram: "https://t.me/clime_help",
    line: "https://line.me/R/ti/p/@clime",
    channeltalk: "https://desk.channel.io/teams/clime"
  };
  const content = freshContent();
  content.headline = "클라임유심 안내";
  content.intro = "개통 가능 여부를 확인하세요.";
  content.supportLinks = supportLinks;
  const save = await onRequest({
    request: new Request("https://admin.climekr.com/api/content", {
      method: "PUT",
      headers: { ...sessionHeaders, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
      body: JSON.stringify(content)
    }),
    env
  });
  assert.equal(save.status, 200);
  assert.equal(save.headers.get("cache-control"), "no-store");
  assert.deepEqual((await save.json()).content.supportLinks, supportLinks);

  const read = await onRequest({ request: new Request("https://climekr.com/api/content"), env });
  assert.equal(read.headers.get("cache-control"), "no-store");
  assert.deepEqual((await read.json()).supportLinks, supportLinks);

  const previousEditorPayload = { ...content };
  delete previousEditorPayload.supportLinks;
  previousEditorPayload.headline = "기존 편집기에서 수정한 제목";
  const previousEditorSave = await onRequest({
    request: new Request("https://admin.climekr.com/api/content", {
      method: "PUT",
      headers: { ...sessionHeaders, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
      body: JSON.stringify(previousEditorPayload)
    }),
    env
  });
  assert.equal(previousEditorSave.status, 200);
  assert.deepEqual((await previousEditorSave.json()).content.supportLinks, supportLinks);
});

test("rejects unsafe consultation link schemes", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const content = freshContent();
  content.headline = "클라임유심 안내";
  content.intro = "개통 가능 여부를 확인하세요.";
  content.supportLinks = { telegram: "", line: "", channeltalk: "" };
  for (const unsafeLink of ["javascript:alert(1)", "http://t.me/clime_help", "not-a-url", "https://user:pass@example.com"]) {
    const response = await onRequest({
      request: new Request("https://admin.climekr.com/api/content", {
        method: "PUT",
        headers: { ...sessionHeaders, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
        body: JSON.stringify({ ...content, supportLinks: { ...content.supportLinks, telegram: unsafeLink } })
      }),
      env
    });
    assert.equal(response.status, 400, `unsafe URL should be rejected: ${unsafeLink}`);
    assert.match((await response.json()).error, /상담 링크/);
  }
});

test("rejects CMS content that changes the three-step user journey", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const base = freshContent();
  base.headline = "클라임유심 안내";
  base.intro = "현재 개통 현황을 확인하세요.";
  base.checklist = [{ title: "개통 현황 조회", body: "KAIT에서 확인합니다." }, { title: "사진 제출", body: "확인 화면을 첨부합니다." }, { title: "상태 조회", body: "접수번호로 확인합니다." }];
  base.faqs = [{ question: "누가 확인하나요?", answer: "운영자가 확인합니다." }];
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

  assert.equal(data.schemaVersion, 4);
  assert.equal(data.legacyContent, true);
  assert.equal(data.headline, "유심 개통 가능하면\n최대 {{MAX_TOTAL}}");
  assert.equal(data.intro, DEFAULT_CONTENT.intro);
  assert.deepEqual(data.checklist.map(step => step.title), ["1. 개통 가능 여부 확인", "2. 사진 보내고 상담하기", "3. 조건 확인 후 안내"]);
  assert.match(data.checklist[0].body, /조회 사이트/);
  assert.equal(data.checklist[1].body, DEFAULT_CONTENT.checklist[1].body);
  assert.match(data.faqs.find(item => item.question === "상담하거나 사진을 보내면 바로 지급되나요?").answer, /신청 내용과 유지 조건 확인/);
  assert.doesNotMatch(JSON.stringify(data), /통신사|요금·약정|월 요금|해지 비용|사진 사전 검토/);
  assert.equal(cloudflare.siteContent.get("home").content, JSON.stringify(legacy));
});

test("archives legacy homepage copy before saving the current editable content", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const cloudflare = createMemoryCloudflare();
  const legacy = { headline: "이전 제목", intro: "이전 문구", checklist: [], faqs: [] };
  cloudflare.siteContent.set("home", { id: "home", content: JSON.stringify(legacy), updated_at: "2026-10-24T00:00:00.000Z" });
  const env = createAdminEnvironment({ cloudflare });
  const sessionHeaders = await createAdminSessionHeaders(env);
  const content = freshContent();
  content.headline = "클라임유심 안내";
  content.intro = "현재 홈페이지 첫 안내입니다.";
  content.checklist = [
    { title: "1. 개통 현황 확인", body: "KAIT 공식 조회를 이용하세요." },
    { title: "2. 사진 사전 검토 신청", body: "확인 화면을 첨부하세요." },
    { title: "3. 접수번호로 결과 확인", body: "접수번호로 확인하세요." }
  ];
  content.faqs = [{ question: "사진은 누가 확인하나요?", answer: "로그인한 운영자가 확인합니다." }];
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
  assert.equal(data.content.schemaVersion, 4);
  assert.equal(JSON.parse(cloudflare.siteContent.get("home").content).headline, content.headline);
  assert.equal(JSON.parse(cloudflare.siteContent.get("home_legacy").content).headline, legacy.headline);
});


test("migrates photo-form copy while preserving safe consultation links", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const cloudflare = createMemoryCloudflare();
  const stored = {schemaVersion:2,headline:"old form",intro:"upload",supportLinks:{telegram:"https://t.me/existing_operator",line:"javascript:alert(1)",channeltalk:"https://user:password@chat.example"}};
  cloudflare.siteContent.set("home",{id:"home",content:JSON.stringify(stored),updated_at:"2026-10-25T00:00:00Z"});
  const response = await onRequest({request:new Request("https://climekr.com/api/content"),env:createAdminEnvironment({cloudflare})});
  const data = await response.json();
  assert.equal(data.schemaVersion,4);
  assert.equal(data.supportLinks.telegram,stored.supportLinks.telegram);
  assert.equal(data.supportLinks.line,"");
  assert.equal(data.supportLinks.channeltalk,"");
  assert.equal(data.intro, DEFAULT_CONTENT.intro);
  assert.equal(cloudflare.siteContent.get("home").content,JSON.stringify(stored));
});

test("old open editors cannot restore the retired application journey", async () => {
  const { onRequest, DEFAULT_CONTENT } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({cloudflare:createMemoryCloudflare()});
  const headers = await createAdminSessionHeaders(env);
  const response = await onRequest({request:new Request("https://admin.climekr.com/api/content",{method:"PUT",headers:{...headers,origin:"https://admin.climekr.com","Content-Type":"application/json"},body:JSON.stringify({...DEFAULT_CONTENT,schemaVersion:2})}),env});
  assert.equal(response.status,409);
});


test("saving migrated content without optional links preserves previously configured chats", async () => {
  const { onRequest, DEFAULT_CONTENT } = await import("../functions/api/content.js");
  const cloudflare=createMemoryCloudflare();
  cloudflare.siteContent.set("home",{id:"home",content:JSON.stringify({...DEFAULT_CONTENT,schemaVersion:2,supportLinks:{telegram:"https://t.me/existing_operator",line:"",channeltalk:""}}),updated_at:"2026-10-25T00:00:00Z"});
  const env=createAdminEnvironment({cloudflare});
  const headers=await createAdminSessionHeaders(env);
  const {supportLinks,...content}=DEFAULT_CONTENT;
  const response=await onRequest({request:new Request("https://admin.climekr.com/api/content",{method:"PUT",headers:{...headers,origin:"https://admin.climekr.com","Content-Type":"application/json"},body:JSON.stringify(content)}),env});
  assert.equal(response.status,200);
  assert.equal((await response.json()).content.supportLinks.telegram,"https://t.me/existing_operator");
});

test("rejects null editor payloads with a validation response", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const env=createAdminEnvironment({cloudflare:createMemoryCloudflare()});
  const headers=await createAdminSessionHeaders(env);
  const response=await onRequest({request:new Request("https://admin.climekr.com/api/content",{method:"PUT",headers:{...headers,origin:"https://admin.climekr.com","Content-Type":"application/json"},body:"null"}),env});
  assert.equal(response.status,400);
});

test("upgrades current v3 homepage edits to v4 without losing the lookup or chat links", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const cloudflare = createMemoryCloudflare();
  const v3 = {
    schemaVersion: 3,
    headline: "운영자가 편집한 제목",
    intro: "운영자가 편집한 안내",
    checklist: [
      { title: "1. 조회", body: "현재 가능 여부를 조회합니다." },
      { title: "2. 신청", body: "결과를 상담창에 보냅니다." },
      { title: "3. 확인", body: "조건 확인 후 안내합니다." }
    ],
    faqs: [
      { question: "왜 모집하나요?", answer: "조회와 조건 확인을 돕기 위해 안내합니다." },
      { question: "왜 참여자를 모집하나요?", answer: "유심 개통 실적 향상을 위한 참여 안내입니다." }
    ],
    supportLinks: { telegram: "https://t.me/current", line: "", channeltalk: "https://desk.channel.io/current" }
  };
  cloudflare.siteContent.set("home", { id: "home", content: JSON.stringify(v3), updated_at: "2026-10-25T00:00:00.000Z" });
  const response = await onRequest({ request: new Request("https://climekr.com/api/content"), env: createAdminEnvironment({ cloudflare }) });
  const data = await response.json();
  assert.equal(data.schemaVersion, 4);
  assert.equal(data.legacyContent, true);
  assert.equal(data.headline, v3.headline);
  assert.equal(data.intro, v3.intro);
  assert.deepEqual(data.checklist, v3.checklist);
  assert.deepEqual(data.faqs[0], v3.faqs[0]);
  assert.equal(data.faqs[1].answer, DEFAULT_CONTENT.faqs.find(item => item.question === "왜 참여자를 모집하나요?").answer);
  assert.deepEqual(data.supportLinks, v3.supportLinks);
  assert.equal(data.lookup.url, "https://www.credit.or.kr/credit/search");
  assert.deepEqual(data.payout.milestones.map(item => item.amount), [50000, 70000, 100000]);
});

test("saves editable public screen content with derived payout totals and validated lookup links", async () => {
  const { onRequest, DEFAULT_CONTENT } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const content = structuredClone(DEFAULT_CONTENT);
  content.lookup.url = "https://lookup.example/eligibility";
  content.payout.milestones[0].amount = 60000;
  content.payout.milestones[1].amount = 40000;
  content.payout.milestones[2].amount = 50000;
  content.payout.maxCases = 2;
  content.copy.contactTitle = "상담 안내";
  content.copy.statusLoading = "조회 중입니다.";
  content.copy.privacySummary = "기존 접수 정보 안내";
  content.operator.email = "help@climekr.com";
  content.seo.title = "클라임유심 안내";
  const response = await onRequest({
    request: new Request("https://admin.climekr.com/api/content", {
      method: "PUT",
      headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
      body: JSON.stringify(content)
    }), env
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.content.schemaVersion, 4);
  assert.equal(data.content.lookup.url, content.lookup.url);
  assert.equal(data.content.payout.maxCases, 2);
  assert.equal(data.content.copy.statusLoading, "조회 중입니다.");
  assert.equal(data.content.operator.email, "help@climekr.com");
  assert.equal(data.content.seo.title, "클라임유심 안내");
  assert.equal(data.content.payout.milestones.reduce((sum, item) => sum + item.amount, 0) * data.content.payout.maxCases, 300000);
});

test("rejects unsafe lookup URLs, invalid payout schedules, and malformed public contact details", async () => {
  const { onRequest, DEFAULT_CONTENT } = await import("../functions/api/content.js");
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare() });
  const headers = await createAdminSessionHeaders(env);
  const invalidCases = [
    content => { content.lookup.url = "javascript:alert(1)"; },
    content => { content.lookup.url = "http://lookup.example"; },
    content => { content.payout.milestones[1].days = content.payout.milestones[0].days; },
    content => { content.payout.milestones[0].amount = -1; },
    content => { content.payout.maxCases = 4; },
    content => { content.operator.email = "not-an-email"; }
  ];
  for (const mutate of invalidCases) {
    const content = structuredClone(DEFAULT_CONTENT);
    mutate(content);
    const response = await onRequest({
      request: new Request("https://admin.climekr.com/api/content", {
        method: "PUT",
        headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
        body: JSON.stringify(content)
      }), env
    });
    assert.equal(response.status, 400);
  }
});


test("converts pasted literal backslash-n into real newlines for public multiline CMS copy", async () => {
  const { onRequest } = await import("../functions/api/content.js");
  const cloudflare = createMemoryCloudflare();
  const env = createAdminEnvironment({ cloudflare });
  const headers = await createAdminSessionHeaders(env);
  const content = freshContent();
  const slashN = String.fromCharCode(92) + "n";
  const introLines = [
    "첫 줄 안내입니다.",
    "둘째 줄에서 조건을 확인하세요."
  ];
  const footerLines = [
    "고객 개통·통신 비용 회사 전액 부담",
    "유지 조건 충족 시 최대 {{MAX_CASES}}건 · 최대 {{MAX_TOTAL}} 지급 대상"
  ];
  const contactLines = ["편한 상담 채널을 선택해 주세요.", "상담창에서 안내받을 수 있습니다."];
  content.intro = introLines.join(slashN);
  content.copy.footerTerms = footerLines.join(slashN);
  content.copy.contactIntro = contactLines.join(slashN);

  const response = await onRequest({
    request: new Request("https://admin.climekr.com/api/content", {
      method: "PUT",
      headers: { ...headers, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
      body: JSON.stringify(content)
    }),
    env
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  const expectedIntro = introLines.join("\n");
  const expectedFooter = footerLines.join("\n");
  assert.equal(result.content.intro, expectedIntro);
  assert.equal(result.content.copy.footerTerms, expectedFooter);
  assert.equal(result.content.copy.contactIntro, contactLines.join("\n"));
  assert.equal(result.content.intro.includes(slashN), false);
  assert.equal(result.content.copy.footerTerms.includes(slashN), false);
  assert.deepEqual(result.content.payout, content.payout, "payout is unchanged");

  const saved = JSON.parse(cloudflare.siteContent.get("home").content);
  assert.equal(saved.intro, expectedIntro);
  assert.equal(saved.copy.footerTerms, expectedFooter);
  const live = await onRequest({ request: new Request("https://climekr.com/api/content"), env });
  assert.equal(live.status, 200);
  const publicContent = await live.json();
  assert.equal(publicContent.intro, expectedIntro);
  assert.equal(publicContent.copy.footerTerms, expectedFooter);
});
