import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const adminContent = await readFile(new URL("../public/admin/content.html", import.meta.url), "utf8");
const contentApi = await readFile(new URL("../functions/api/content.js", import.meta.url), "utf8");
const userFlowCss = await readFile(new URL("../public/user-flow.css", import.meta.url), "utf8");

test("preserves the supplied Korean responsive page and its main visual sections", () => {
  for (const content of ["<html lang=\"ko\">", "class=\"hero-payouts\"", "id=\"precheckForm\"", "id=\"statusLookupDetails\"", "id=\"faq\"", "id=\"contact\"", "class=\"sim-image\""]) {
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

test("leads with the offer and keeps secondary tasks out of the way", () => {
  assert.doesNotMatch(html, /class="task-nav"|data-view-link|data-view-panel/);
  assert.match(html, /id="hero-title">유심 개통 가능하면<br>최대 51만원<\/h1>/);
  assert.match(html, /id="eligibilityButton"[^>]*>개통 가능 여부 확인하기/);
  assert.match(html, /id="heroApplyButton"[^>]*href="#apply">사진 심사 신청하기/);
  assert.match(html, /href="#statusLookupDetails"[^>]*>이미 신청했어요\? 접수 조회/);
  assert.match(html, /<details class="application-details" id="apply"/);
  assert.match(html, /<details class="guide-disclosure" id="benefits"/);
  assert.match(userFlowCss, /\.application-details:not\(\[open\]\),\.lookup-details:not\(\[open\]\) \{ display: none/);
  assert.match(userFlowCss, /\.application-details:not\(\[open\]\) > \.application-trigger,\.lookup-details:not\(\[open\]\) > \.lookup-disclosure \{ display: none/);
  assert.match(html, /href="\/user-flow\.css"/);
});

test("loads Turnstile only after a valid submission attempt and lets users retry failures", () => {
  assert.match(html, /form\.addEventListener\(['"]submit['"]/);
  assert.match(html, /await setupTurnstile\(\)/);
  assert.match(html, /turnstile\.execute\(turnstileWidget\)/);
  assert.match(html, /id="retryTurnstile"/);
  assert.match(html, /retryTurnstile\.addEventListener/);
  assert.doesNotMatch(html, /loadTurnstileWhenNeeded|observeWhenOpen|접수 영역에 가까워지면 자동 확인을 불러옵니다/);
});

test("explains eligibility, the payout amounts, and the photo application in one simple flow", () => {
  assert.match(html, /id="homeIntro">먼저 개통 가능 여부를 확인하세요\.\n조회 후 사진 한 장으로 신청하세요\.<\/p>/);
  assert.match(html, /class="hero-payouts"[\s\S]*3일 유지 후[\s\S]*5만원 지급[\s\S]*15일 유지 후[\s\S]*5만원 추가 지급[\s\S]*30일 유지 후[\s\S]*7만원 추가 지급/);
  assert.match(html, /한 건 최대 17만원 · 최대 3건 · 총 최대 51만원/);
  assert.match(html, /id="quickFlow"><span>가능 여부 확인<\/span><span aria-hidden="true">→<\/span><span>심사 신청<\/span><span aria-hidden="true">→<\/span><span>유지 확인 후 지급<\/span>/);
  assert.match(html, /id="eligibilityButton"[^>]*href="https:\/\/www\.credit\.or\.kr\/credit\/search"/);
  assert.match(html, /class="application-trigger"><span>사진 심사 신청하기<\/span>/);
  assert.match(userFlowCss, /\.step-action \{[^}]*display:\s*flex[^}]*max-width:\s*100%[^}]*white-space:\s*nowrap[^}]*font-size:\s*13px/);
  assert.match(userFlowCss, /\.step-action \+ \.step-action \{[^}]*margin-top:\s*6px/);
  assert.match(html, /id="apply-title">가능 여부 심사 신청/);
  assert.match(html, /조회 후 사진 한 장으로 신청하세요/);
  assert.match(html, /조회하신 내역을 캡처해서 신청하세요/);
  assert.match(html, /<h4>2\. 가능 여부 심사 신청<\/h4><p>조회하셨다면 조회하신 내역을 캡처해서 신청하세요\.<\/p>/);
  assert.match(html, /heroApplyButton\.addEventListener\(['"]click['"]/);
  assert.match(html, /heroApplyButton\.addEventListener[\s\S]*?applyDisclosure\.open=true/);
  assert.doesNotMatch(html, /guideDisclosure\.open\s*=\s*true/);
  assert.match(html, /id="submitApplication"[^>]*>신청하기/);
  assert.match(html, /<div class="application-form-content">\s*<form id="precheckForm">/);
  assert.match(html, /<details class="lookup-details" id="statusLookupDetails">/);
  assert.match(html, /statusLookupDetails\.open=true/);
  assert.doesNotMatch(html, /activateView|hashViews/);
});

test("keeps feedback and footer copy legible and wrapped on small screens", () => {
  assert.match(html, /class="site-footer__brand"/);
  assert.match(html, /class="site-footer__terms"/);
  assert.doesNotMatch(html, /class="demo-chip"/);
  assert.match(userFlowCss, /#toast\.toast[^}]*font-size:\s*16px/);
  assert.match(userFlowCss, /\.site-footer\s*\{[^}]*display:\s*grid/);
  assert.match(userFlowCss, /@media\s*\(max-width:\s*760px\)[\s\S]*\.site-footer\s*\{[^}]*font-size:\s*13px/);
  assert.match(userFlowCss, /\.site-footer__terms[^}]*line-height:\s*1\.75/);
  assert.match(userFlowCss, /\.hero-art \{ display: block; width: min\(100%, 270px\)/);
});

test("preserves intentional sentence breaks in public and published copy", () => {
  assert.match(contentApi, /intro:\s*"먼저 개통 가능 여부를 확인하세요\.\\n조회 후 사진 한 장으로 신청하세요\."/);
  assert.match(adminContent, /intro:"먼저 개통 가능 여부를 확인하세요\.\\n조회 후 사진 한 장으로 신청하세요\."/);
  assert.match(userFlowCss, /\.hero-intro,.terms-hint,.hero-caveat,[\s\S]*?\.site-footer__terms\s*\{\s*white-space:\s*pre-line;\s*line-height:\s*1\.85/);
  assert.match(userFlowCss, /\.hero-intro[^}]*line-height:\s*1\.85/);
  assert.match(adminContent, /Enter로 줄을 나눌 수 있습니다/);
});

test("restores the original dark navy and mint visual palette", () => {
  const originalTheme = userFlowCss.slice(userFlowCss.lastIndexOf("/* Restore the original USIM PLUS"));
  assert.match(originalTheme, /color-scheme:\s*dark/);
  assert.match(originalTheme, /--flow-canvas:\s*#040a11/i);
  assert.match(originalTheme, /--flow-surface:\s*#0a1724/i);
  assert.match(originalTheme, /body::before,body::after\s*\{[^}]*display:\s*block/);
  assert.match(originalTheme, /\.site-shell\s*\{[^}]*linear-gradient\(165deg,rgba\(8,18,29,\.98\),rgba\(4,11,20,\.99\)\)/);
  assert.doesNotMatch(originalTheme, /#f3f6f8|#ffffffed|background:\s*#fff(?:;|\s)|color-scheme:\s*light/i);
  assert.match(html, /<meta name="theme-color" content="#040a11" \/>/);
  assert.match(html, /<meta name="color-scheme" content="dark" \/>/);
});

test("keeps the public participation flow at exactly three CMS-editable steps", () => {
  assert.match(adminContent, /참여 단계는 세 개로 고정되어 있습니다/);
  assert.match(adminContent, /intro:"먼저 개통 가능 여부를 확인하세요\.\\n조회 후 사진 한 장으로 신청하세요\."/);
  assert.match(adminContent, /title:"1\. 개통 가능 여부 확인"/);
  assert.match(adminContent, /title:"2\. 가능 여부 심사 신청"/);
  assert.match(adminContent, /body:"조회하셨다면 조회하신 내역을 캡처해서 신청하세요\."/);
  assert.match(adminContent, /title:"3\. 유지 조건 확인 후 지급"/);
  assert.match(adminContent, /question:"사진 확인 후 바로 지급되나요\?"/);
  assert.doesNotMatch(adminContent, /사진 사전 검토|운영자 사전 검토/);
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
  for (const content of ["조회 내역 캡처", "30일", "에스씨아이평가정보(주)", "임동훈", "help@climekr.com", "동의하지 않으면", "Cloudflare"]) {
    assert.ok(html.includes(content), `missing privacy disclosure: ${content}`);
  }
});

test("discloses receipt status metadata cleanup in plain Korean", () => {
  assert.match(html, /접수 상태[\s\S]*?60일이 지나면 정기 삭제/);
  assert.match(html, /접수 또는 검토 결정 후 60일이 지나면 정기 삭제 대상/);
  assert.match(html, /60일.*정기 삭제 대상/);
  assert.match(html, /정기 삭제 시각에 따라[\s\S]*?실제 삭제가 조금 늦어질 수/);
  assert.doesNotMatch(html, /최대 30일 더 보관|예약 작업/);
});

test("keeps the public offer short and removes telecom price and contract wording", () => {
  const hero = html.match(/<section class="hero"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(hero, "hero offer exists");
  assert.match(hero, /유심 개통 가능하면[\s\S]*최대 51만원/);
  assert.match(hero, /개통 가능 여부 확인하기/);
  assert.match(hero, /사진 심사 신청하기/);
  assert.doesNotMatch(html, /개통 후 사진 신청|개통 후 신청하기|개통 후 사진 한 장으로 신청|개통하셨다면 사진/);
  assert.doesNotMatch(html, /통신사|요금·약정|월 요금|해지 비용|KAIT/);
  assert.doesNotMatch(html, /사진 사전 검토|운영자 사전 검토/);
  assert.doesNotMatch(hero, /접수번호|조회 코드/);
  assert.match(html, /유지 조건을 확인한 뒤 지급 대상이 결정됩니다/);
  assert.doesNotMatch(html, /내 신청 가능 개수 확인|내 개통 가능 수량 확인/);
});

test("explains duplicate review and retention without exposing implementation jargon", () => {
  assert.match(html, /같은 사진 또는 같은 인터넷 접속.*확인/);
  assert.match(html, /인터넷 주소\(IP\) 원문은 저장하지 않습니다/);
  assert.match(html, /같은 인터넷 접속.*같은 사람이라고 단정/);
  assert.match(html, /사진.*30일/);
  assert.match(html, /접수 상태[\s\S]*?60일이 지나면 정기 삭제/);
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
