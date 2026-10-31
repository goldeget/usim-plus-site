import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const topicPages = [
  "../public/topics/index.html",
  "../public/topics/urgent-money/index.html",
  "../public/topics/loan-rejected/index.html",
  "../public/topics/small-loan-alternatives/index.html",
  "../public/topics/business/index.html",
  "../public/topics/housewife/index.html",
  "../public/topics/student/index.html",
  "../public/topics/worker/index.html",
  "../public/topics/usim-benefit/index.html"
];

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const adminContent = await readFile(new URL("../public/admin/content.html", import.meta.url), "utf8");
const adminContentEditor = await readFile(new URL("../public/admin/content-editor.js", import.meta.url), "utf8");
const contentApi = await readFile(new URL("../functions/api/content.js", import.meta.url), "utf8");
const userFlowCss = await readFile(new URL("../public/user-flow.css", import.meta.url), "utf8");

test("preserves the dark visual identity and exposes direct consultation without a file form", () => {
  for (const element of ['<html lang="ko">','class="hero-payouts"','class="sim-image"','id="contact"','id="heroApplyButton" href="#contact"']) assert.ok(html.includes(element), element);
  assert.doesNotMatch(html, /type="file"|id="precheckForm"|FormData|challenges\.cloudflare\.com|turnstile\.render/);
  assert.match(html.replace(/<\/?span[^>]*>/g, ""), /몰랐던 유심 혜택으로 최대 66만원\.<br>3일·15일·30일 유지 확인 후 단계 지급 대상이 정해집니다\.<br>자세한 혜택·조건은 텔레그램·채널톡 상담으로 안내합니다\./);
  assert.match(html, /name="color-scheme" content="dark"/);
});

test("keeps existing receipt status lookup and privacy information after new submissions end", () => {
  assert.match(html,/\/api\/applications\/status/);
  assert.match(html,/기존 접수 조회/);
  assert.match(html,/기존 홈페이지 접수의 개인정보 보관 안내/);
  assert.match(html,/statusRetention/);
  assert.match(html,/photoRetentionAfterDecision/);
  assert.match(contentApi,/statusMetadata:\s*60/);
  assert.match(contentApi,/photoAfterDecision:\s*30/);
  assert.match(html,/같은 인터넷 접속.*같은 사람이라고 단정/);
  assert.match(html,/상담창으로 보낸 사진과 진행 상황은 같은 상담창에서/);
});

test("consultation addresses remain managed by the authenticated editor", () => {
  for(const key of ['telegram','channeltalk']) {
    assert.match(html,new RegExp(`data-contact="${key}"`));
    assert.match(adminContent,new RegExp(`id="${key}Link"`));
  }
  assert.doesNotMatch(html,/data-contact="line"/,"LINE is intentionally hidden from the public homepage");
  assert.match(adminContent,/id="lineLink"/,"admin configuration retains LINE for possible future reactivation");
  assert.match(html,/updateContactLinks\(content\.supportLinks,copy,content\.operator\)/);
  assert.match(html,/content\.schemaVersion===4/);
  assert.match(html,/candidate\.protocol==='https:'/);
  assert.match(html,/if\(anchor\.getAttribute\('aria-disabled'\)!=='true'\)return/);
  assert.match(adminContent,/사진은 상담 채널에서 직접 주고받습니다/);
  assert.match(contentApi,/현재 연결된 상담 채널이 없습니다/);
  assert.match(html,/mailto:help@climekr\.com/);
});

test("keeps visible centered feedback for lookup and unavailable channels", () => {
  assert.match(html,/id="toastTitle"/);
  assert.match(html,/id="toastMessage"/);
  assert.match(html,/showToast\(copy\.statusErrorTitle/);
  assert.match(html,/copy\?\.channelUnavailableTitle/);
  assert.match(userFlowCss,/#toast\.toast\s*\{[^}]*left:\s*50%[^}]*top:\s*50%/);
});

test("shows the operator registration details requested for the current footer", () => {
  assert.match(html,/서울평가정보㈜/);
  assert.match(html,/대표이사.*김중근/);
  for(const value of ['114-81-47958','제2022-서울영등포-2646호','서울시 영등포구 국회대로70길 23(여의도동, 용산빌딩)','02-3449-1678']) assert.equal(html.includes(value),true);
});


test("preserves the original query destination separately from photo conversations", () => {
  const links=[...html.matchAll(/<a\b[^>]*href="https:\/\/www\.credit\.or\.kr\/credit\/search"[^>]*>/g)];
  assert.equal(links.length,2,"lookup stays on the hero button and the contact panel");
  for(const link of links){assert.match(link[0],/target="_blank"/);assert.match(link[0],/rel="noopener noreferrer"/);}
  assert.match(html, /id="eligibilityButton"[^>]*>혜택 가능 여부 조회/);
  assert.match(html, /id="contactLookupLabel">혜택 가능 여부 조회/);
  assert.match(html, /id="contactLookupLink"/);
  assert.match(html, /id="heroApplyButton" href="#contact">텔레그램·채널톡 상담하기/);
  assert.match(html, /lookupButton\.href=content\.lookup\.url/);
  assert.match(html, /contactLookupLink\.href=content\.lookup\.url/);
  assert.doesNotMatch(html,/type="file"/);
});

test("topic pages keep the benefit lookup and the 66만 consult story", async () => {
  const banned = /대출|급전|폰깡|대포폰|스미싱|보이스피싱|수거|고객 보유|폰테크/;
  for (const file of topicPages) {
    const page = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(page, banned, file);
    assert.match(page, /몰랐던 유심 혜택으로<br><strong>최대 66만원<\/strong>/, file);
    assert.match(page, /https:\/\/www\.credit\.or\.kr\/credit\/search/, file);
    assert.match(page, /텔레그램/, file);
    assert.match(page, /climeusim\.channel\.io/, file);
  }
});

test("admin-managed public copy covers payouts, lookup, privacy, footer, status, and search metadata", () => {
  for (const id of ["heroCopyFields", "payoutFields", "lookupUrl", "contactCopyFields", "guideCopyFields", "statusCopyFields", "privacyCopyFields", "footerCopyFields", "seoFields", "operatorEmail"]) assert.ok(adminContent.includes(`id="${id}"`), id);
  assert.match(adminContentEditor, /schemaVersion:\s*4/);
  assert.match(adminContentEditor, /lookup:\s*\{/);
  assert.match(adminContentEditor, /payout:\s*\{/);
  assert.match(adminContentEditor, /copy:\s*readCopy\(\)/);
  for (const id of ["statusDisclosure", "privacyCollection", "privacyPurpose", "privacyStorage", "footerTerms", "seoDescription", "ogTitle", "twitterDescription"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /content\.schemaVersion===4/);
  assert.doesNotMatch(html, /faqList|faqSchema|payoutFaq\(content\)/);
  assert.match(html, /lookupButton\.href=content\.lookup\.url/);
  assert.match(html, /textContent=/);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  assert.match(adminContent, /수집 항목, 이용 목적, 보관 방식, 동의 거부와 처리 서비스 안내는 실제 운영 방식에 맞춰 고정/);
  for (const key of ["privacyCollection", "privacyPurpose", "privacyStorage", "privacyConsent", "privacyProvider"]) {
    assert.doesNotMatch(adminContentEditor, new RegExp(`\\["${key}",`), `${key} is not an editable privacy fact`);
  }
  assert.match(adminContentEditor, /data\.retentionDays\s*\|\|\s*retentionDays/);
  assert.match(adminContentEditor, /Number\.isInteger\(sourceIndex\).*original\.faqs\[sourceIndex\]/s);
});


test("renders the homepage announcement lines and the footer without visible backslash-n", () => {
  const expectedIntro = [
    "몰랐던 유심 혜택으로 최대 66만원.",
    "3일·15일·30일 유지 확인 후 단계 지급 대상이 정해집니다.",
    "자세한 혜택·조건은 텔레그램·채널톡 상담으로 안내합니다."
  ].join("<br>");
  const heroIntroHtml = html.match(/<div class="hero-intro copy-prose" id="homeIntro">([\s\S]*?)<\/div>/)[1];
  assert.equal(heroIntroHtml.replace(/<\/?span[^>]*>/g, ''), expectedIntro);
  assert.doesNotMatch(html, /id="homeIntro"[^>]*>[\s\S]*?\{\{MAX_TOTAL\}\}/);
  const normalizedHtml = html.replace(/\r\n/g, "\n");
  assert.ok(normalizedHtml.includes('<p class="site-footer__terms" id="footerTerms">몰랐던 유심 혜택 · 최대 66만원\n자세한 혜택·조건은 텔레그램·채널톡 상담</p>'));
  assert.match(html, /renderHeroIntro\(document\.getElementById\('homeIntro'\),content\.intro,content\)/);
  assert.match(html, /normalizeDisplayedLineBreaks\(expandTokens\(value,content\)\)/);
  assert.match(html, /normalizeDisplayedLineBreaks\(expandTokens\(copy\.footerTerms,content\)\)/);
  assert.match(html, /function normalizeDisplayedLineBreaks\(value\)/);
  assert.match(userFlowCss, /\.hero-intro,[^{]*\.site-footer__terms \{ white-space: pre-line; line-height: 1\.85; \}/);
  assert.doesNotMatch(expectedIntro, /\\n|\{\{MAX_TOTAL\}\}/);
});

test("removes public FAQ and the invisible FAQ schema without removing consultation or archived CMS data", () => {
  assert.doesNotMatch(html, /<section class="faq"|id="faq-title"|class="faq-list"/);
  assert.doesNotMatch(html, /FAQPage|faqSchema|faqList/);
  assert.doesNotMatch(userFlowCss, /\.faq(?:\s|\.|\{|-)/);
  assert.doesNotMatch(html, /class="guide-disclosure"|신청 방법|신청 순서|유심 혜택 확인 순서/);
  assert.match(html, /id="contact"/);
  assert.match(html, /id="payoutConditions"/);
  assert.match(contentApi, /faqs: content\.faqs\.map/);
});
