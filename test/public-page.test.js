import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const adminContent = await readFile(new URL("../public/admin/content.html", import.meta.url), "utf8");
const contentApi = await readFile(new URL("../functions/api/content.js", import.meta.url), "utf8");
const userFlowCss = await readFile(new URL("../public/user-flow.css", import.meta.url), "utf8");

test("preserves the supplied Korean responsive page and its main visual sections", () => {
  for (const content of ["<html lang=\"ko\">", "class=\"application-reward\"", "id=\"precheckForm\"", "id=\"statusLookupDetails\"", "id=\"faq\"", "id=\"contact\"", "class=\"sim-image\""]) {
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

test("leads with one clear offer and hides secondary tasks from the main navigation", () => {
  assert.doesNotMatch(html, /class="task-nav"|data-view-link|data-view-panel/);
  assert.match(html, /id="hero-title">유심 개통하면<br>최대 51만원<\/h1>/);
  assert.match(html, /3일 5만원.*15일 추가 5만원.*30일 추가 7만원/);
  assert.match(html, /id="heroApplyButton"[^>]*href="#benefits"[^>]*>참여 조건 먼저 확인하기/);
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

test("asks visitors to check conditions before opening a line and submit photos after activation", () => {
  assert.match(html, /id="homeIntro">개통 전 참여 조건과 통신사 요금·약정을 먼저 확인하세요\.\n\s*참여를 원하면 개통 후 현황 사진으로 신청하세요\.<\/p>/);
  assert.match(html, /id="quickFlow"><span>개통 전 조건 확인<\/span><span aria-hidden="true">→<\/span><span>개통 후 사진 신청<\/span><span aria-hidden="true">→<\/span><span>유지 조건 확인 후 지급<\/span>/);
  assert.match(html, /<h4>1\. 개통 전 조건 확인<\/h4><p>개통 전에 지급 조건과 통신사 공식 안내를 확인하세요\.\n\s*월 요금, 약정 기간, 해지 비용도 먼저 살펴보세요\.<\/p>/);
  assert.match(html, /<h4>2\. 개통 후 사진 신청<\/h4><p>조건에 맞으면 유심을 개통하세요\.\n\s*개통 현황이 보이는 화면을 사진으로 보내 신청합니다\.<\/p>/);
  assert.match(html, /href="#apply">개통 후 사진 보내고 신청하기<\/a>/);
  assert.match(userFlowCss, /\.step-action \{[^}]*display:\s*flex[^}]*max-width:\s*100%[^}]*white-space:\s*normal/);
  assert.match(userFlowCss, /\.step-action \+ \.step-action \{[^}]*margin-top:\s*6px/);
  assert.match(html, /class="application-trigger"><span>이미 개통하셨나요\? 사진 보내기<\/span><small>개통 현황 사진/);
  assert.match(html, /id="apply-title">개통 현황 사진으로 신청하기/);
  assert.match(html, /조건을 확인하고 개통하셨다면, 개통 현황이 보이는 화면 1장을 첨부해 주세요/);
  assert.match(html, /heroApplyButton\.addEventListener\(['"]click['"]/);
  assert.match(html, /guideDisclosure\.open\s*=\s*true/);
  assert.doesNotMatch(html, /heroApplyButton\.addEventListener\(['"]click['"],\(\)=>\{applyDisclosure\.open=true\}\)/);
  assert.match(html, /quickFlow\.replaceChildren\(\)/);
  assert.match(html, /label\.textContent=item\.title\.replace/);
  assert.match(html, /class="application-trigger"><span>이미 개통하셨나요\? 사진 보내기<\/span>/);
  assert.match(html, /id="apply-title">개통 현황 사진으로 신청하기/);
  assert.match(html, /id="submitApplication"[^>]*>사진 보내고 확인받기/);
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
  assert.match(contentApi, /intro:\s*"개통 전 참여 조건과 통신사 요금·약정을 먼저 확인하세요\.\\n참여를 원하면 개통 후 현황 사진으로 신청하세요\."/);
  assert.match(adminContent, /intro:"개통 전 참여 조건과 통신사 요금·약정을 먼저 확인하세요\.\\n참여를 원하면 개통 후 현황 사진으로 신청하세요\."/);
  assert.match(userFlowCss, /\.hero-intro,.terms-hint,.hero-caveat,[\s\S]*?\.site-footer__terms\s*\{\s*white-space:\s*pre-line;\s*line-height:\s*1\.85/);
  assert.match(userFlowCss, /\.hero-intro[^}]*line-height:\s*1\.85/);
  assert.match(adminContent, /문장마다 Enter로 줄을 나누면 공개 화면에도 그대로 보입니다/);
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
  assert.match(adminContent, /intro:"개통 전 참여 조건과 통신사 요금·약정을 먼저 확인하세요/);
  assert.match(adminContent, /title:"1\. 개통 전 조건 확인"/);
  assert.match(adminContent, /title:"2\. 개통 후 사진 신청"/);
  assert.match(adminContent, /title:"3\. 유지 조건 확인 후 지급"/);
  assert.match(adminContent, /answer:"아닙니다\. 사진은 신청 내용과 참여 조건을 운영자가 확인/);
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
  for (const content of ["개통 현황 사진", "30일", "에스씨아이평가정보(주)", "임동훈", "help@climekr.com", "동의하지 않으면", "Cloudflare"]) {
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

test("explains the pre-activation check and post-activation photo review without promising a result", () => {
  const hero = html.match(/<section class="hero"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(hero, "hero offer exists");
  assert.match(hero, /유심 개통하면[\s\S]*최대 51만원/);
  assert.match(hero, /개통 전 참여 조건과 통신사 요금·약정을 먼저 확인하세요/);
  assert.match(hero, /href="#benefits"[^>]*>참여 조건 먼저 확인하기/);
  assert.doesNotMatch(html, /사진 사전 검토|운영자 사전 검토/);
  assert.doesNotMatch(hero, /사전 검토|KAIT|접수번호|조회 코드/);
  assert.match(html, /개통 승인[\s\S]*?지급 확정/);
  assert.match(html, /조건과 유지 기간이 확인/);
  assert.doesNotMatch(html, /내 신청 가능 개수 확인|내 개통 가능 수량 확인/);
  assert.match(html, /통신사.*요금.*약정.*해지/);
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
