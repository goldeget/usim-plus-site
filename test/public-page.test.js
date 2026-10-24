import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const adminContent = await readFile(new URL("../public/admin/content.html", import.meta.url), "utf8");
const contentApi = await readFile(new URL("../functions/api/content.js", import.meta.url), "utf8");

test("preserves the supplied Korean responsive page and its main visual sections", () => {
  for (const content of ["<html lang=\"ko\">", "class=\"application-reward\"", "id=\"precheckForm\"", "id=\"applicationFormDetails\"", "id=\"statusLookupDetails\"", "id=\"faq\"", "id=\"contact\"", "class=\"sim-image\""]) {
    assert.ok(html.includes(content), `missing existing page element: ${content}`);
  }
});

test("submits a photo to the real endpoint and keeps a one-time receipt and status lookup", () => {
  assert.match(html, /\/api\/applications(?:["'`])/);
  assert.match(html, /\/api\/applications\/status/);
  assert.match(html, /\/api\/applications\/config/);
  assert.match(html, /FormData/);
  assert.match(html, /cf-turnstile-response/);
  assert.match(html, /조회 코드/);
  assert.match(html, /복사/);
});

test("requires consent and a Turnstile challenge before upload", () => {
  assert.match(html, /id="privacyConsent"[^>]*name="privacyConsent"[^>]*required/);
  assert.match(html, /id="turnstileWidget"/);
  assert.match(html, /turnstile\.render/);
  assert.match(html, /10MB|10MB/);
});

test("defers the Turnstile script until the application section is near the viewport", () => {
  assert.match(html, /new IntersectionObserver/);
  assert.match(html, /rootMargin:\s*['"]240px 0px['"]/);
  assert.match(html, /observe\(form\)/);
  assert.match(html, /applicationFormDetails\.addEventListener\(['"]toggle['"],observeWhenOpen\)/);
  assert.match(html, /접수 영역에 가까워지면 자동 확인을 불러옵니다/);
  assert.doesNotMatch(html, /^\s*setupTurnstile\(\);\s*$/m);
});

test("splits the long user flow into a photo form and a separate status lookup", () => {
  assert.match(html, /참여 방법 3단계/);
  assert.match(html, /id="hero-title">개통 현황 확인 후<br>사진으로 사전 검토 신청<\/h1>/);
  assert.match(html, /class="cta-main" href="#steps">참여 순서 먼저 확인하기/);
  assert.match(html, /href="#apply"[^>]*>사진으로 사전 검토 신청/);
  assert.match(html, /href="#statusLookupDetails"[^>]*>신청 상태 조회/);
  assert.match(html, /id="homeIntro">KAIT에서 조회한 개통 현황을 사진으로 첨부해 사전 검토를 요청합니다\./);
  assert.match(html, /<details class="application-details" id="applicationFormDetails">/);
  assert.match(html, /<details class="lookup-details" id="statusLookupDetails">/);
  assert.match(html, /a href="#statusLookupDetails">상태 조회/);
  assert.match(html, /statusLookupDetails\.open=true/);
});

test("keeps the public participation flow at exactly three CMS-editable steps", () => {
  assert.match(adminContent, /참여 단계는 세 개로 고정되어 있습니다/);
  assert.doesNotMatch(adminContent, /id="addChecklist"/);
  assert.match(contentApi, /value\.checklist\.length !== 3/);
});

test("progressively applies saved homepage content and keeps FAQ structured data in sync", () => {
  assert.match(html, /id="homeIntro"/);
  assert.match(html, /fetch\(["']\/api\/content["']/);
  assert.match(html, /content\.cmsReady\s*&&\s*content\.schemaVersion===2/);
  assert.match(html, /faqSchema\.mainEntity\s*=/);
  assert.match(html, /JSON\.stringify\(structuredData\)/);
});

test("discloses the photo purpose, selected retention, controller, contact, and refusal right", () => {
  for (const content of ["개통 현황 사진", "30일", "에스씨아이평가정보(주)", "임동훈", "help@climekr.com", "동의하지 않으면", "Cloudflare"]) {
    assert.ok(html.includes(content), `missing privacy disclosure: ${content}`);
  }
});

test("discloses receipt status metadata cleanup in plain Korean", () => {
  assert.match(html, /접수 상태.*60일이 지나면 정기 삭제/);
  assert.match(html, /접수 또는 검토 결정 후 60일이 지나면 정기 삭제 대상/);
  assert.match(html, /60일.*정기 삭제 대상/);
  assert.match(html, /정리 시각에 따라 실제 삭제가 조금 늦어질 수/);
  assert.doesNotMatch(html, /최대 30일 더 보관|예약 작업/);
});

test("explains participation and the photo review before promising a result", () => {
  assert.match(html, /사진으로 사전 검토 신청/);
  assert.match(html, /개통 승인.*지급 확정/);
  assert.match(html, /조건을 충족.*유지.*확인/);
  assert.doesNotMatch(html, /내 신청 가능 개수 확인|내 개통 가능 수량 확인/);
  assert.match(html, /통신사.*요금.*약정.*해지/);
});

test("explains duplicate review and retention without exposing implementation jargon", () => {
  assert.match(html, /같은 사진 또는 같은 인터넷 접속.*확인/);
  assert.match(html, /인터넷 주소\(IP\) 원문은 저장하지 않습니다/);
  assert.match(html, /같은 인터넷 접속.*같은 사람이라고 단정/);
  assert.match(html, /사진.*30일/);
  assert.match(html, /접수 상태.*60일이 지나면 정기 삭제/);
  assert.doesNotMatch(html, /조회 토큰|SHA-256|HMAC|Cloudflare R2|D1 관리정보/);
});

test("shows only minimal business identity and support details without publishing the certificate", () => {
  assert.match(html, /<summary>운영자 정보<\/summary>/);
  assert.match(html, /에스씨아이평가정보\(주\)/);
  assert.match(html, /대표자.*임동훈/);
  assert.match(html, /help@climekr\.com/);
  for (const privateCertificateDetail of ["114-81-47958", "110111-0853419", "서울특별시 마포구", "sci0001@hometax.go.kr"]) {
    assert.equal(html.includes(privateCertificateDetail), false, `business certificate detail must remain private: ${privateCertificateDetail}`);
  }
});

test("removes mockup-only claims and gives users the confirmed email contact", () => {
  for (const content of ["현재는 화면 목업입니다", "이 목업에서는", "정식 접수·파일 전송은 연결되지 않은 목업입니다", "목업 시연입니다"]) {
    assert.equal(html.includes(content), false, `stale mockup copy remains: ${content}`);
  }
  assert.match(html, /href="mailto:help@climekr\.com"/);
  assert.doesNotMatch(html, /상담 링크 설정 필요|data-contact="/);
});
