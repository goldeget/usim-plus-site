import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const guide = read('../public/guide/index.html');
const social = read('../public/links/index.html');
const home = read('../public/index.html');
const sitemap = read('../public/sitemap.xml');

test('benefits guide has unique self-canonical and describes actual service', () => {
  assert.match(guide, /<title>혜택 조건 \| 텔레그램·채널톡 상담 \| 클라임유심/);
  assert.match(guide, /rel="canonical" href="https:\/\/climekr\.com\/guide\/"/);
  assert.match(guide, /<h1>몰랐던 유심 혜택으로<br><strong>최대 66만원<\/strong><\/h1>/);
  assert.doesNotMatch(guide.slice(0, guide.indexOf('class="notice"')), /자금이 급할 때|급전|폰깡|통신혜택/);
  assert.match(guide, /혜택은 상담·신청 직후 지급되지 않습니다/);
  assert.match(guide, /href="\/disclosures\/">고지·안내/);
});

test('benefits guide stays short: milestone grid without numbered card explainer blocks', () => {
  assert.doesNotMatch(guide, /지급은 이렇게 결정됩니다|difference-title|<span class="card-number">01<\/span>/);
  assert.match(guide, /유지 기간별 지급 안내/);
  assert.match(guide, /footer-hook/);
});

test('benefits guide displays payout amounts from the current public API', () => {
  assert.match(guide, /fetch\('\/api\/content'/);
  assert.match(guide, /content\.payout/);
  assert.match(guide, /stage\.days/);
  assert.match(guide, /stage\.amount/);
  assert.match(guide, /payout\.maxCases/);
  assert.doesNotMatch(guide, /<strong data-total[^>]*>66만원</);
});

test('consultation links are direct, HTTPS, and restricted to known hosts', () => {
  for (const page of [guide, social]) {
    assert.match(page, /https:\/\/t\.me\/climeusim/);
    assert.match(page, /https:\/\/climeusim\.channel\.io/);
    assert.match(page, /data-channel="telegram"/);
    assert.match(page, /data-channel="channeltalk"/);
    assert.match(page, /url\.protocol\s*!==?\s*'https:'/);
    assert.match(page, /noopener noreferrer/);
    assert.doesNotMatch(page, /https:\/\/line\.me/);
  }
});

test('social links page is noindex; guide is indexed only on official host', () => {
  assert.match(social, /name="robots" content="noindex,follow"/);
  assert.match(guide, /name="robots" content="index,follow/);
  const middleware = read('../functions/_middleware.js');
  assert.match(middleware, /host !== ADMIN_HOST && host !== "climekr\.com"/);
  assert.match(middleware, /noIndex\(await context\.next\(\)\)/);
});

test('site navigation and sitemap include original guide but not social noindex page', () => {
  assert.match(home, /href="\/guide\/"/);
  assert.match(home, /href="\/about\/">CLIME 소개<\/a>/);
  assert.match(home, /href="\/structure\/">사업 구조<\/a>/);
  assert.match(home, /href="\/disclosures\/">고지·안내<\/a>/);
  assert.doesNotMatch(home, /site-footer[\s\S]*href="\/links\/"/);
  assert.match(sitemap, /<loc>https:\/\/climekr\.com\/guide\/<\/loc>/);
  assert.doesNotMatch(sitemap, /climekr\.com\/links/);
});

test('guide removes the entire FAQ section without affecting the benefit details or consultation CTA', () => {
  assert.doesNotMatch(guide, /자주 묻는 질문|faq-title|<details|<summary/);
  assert.doesNotMatch(guide, /대출이 거절되어도 CLIME 유심 혜택을 신청할 수 있나요/);
  assert.match(guide, /aria-labelledby="criteria-title"/);
  assert.match(guide, /data-total/);
  assert.match(guide, /data-milestones/);
  assert.match(guide, /<section class="end wrap" id="contact" aria-labelledby="contact-title">/);
});

test('does not show unsolicited five-point pre-consultation checklist', () => {
  assert.doesNotMatch(guide, /상담 전에 확인할 다섯 가지|상담전에 확인할 다섯가지/);
  assert.doesNotMatch(guide, /check-title|class="checklist"/);
  assert.equal(guide.includes('.checklist'), false);
  assert.match(guide, /id="criteria"/);
  assert.match(guide, /aria-labelledby="criteria-title"/);
  assert.match(guide, /aria-labelledby="contact-title"/);
  assert.match(guide, /data-channel="telegram"/);
  assert.match(guide, /data-channel="channeltalk"/);
});

test('bottom consultation panel stays centered and matches main content gutters on desktop and mobile', () => {
  // On desktop, content sections and the CTA use .wrap's 1100px max width; auto margins center the CTA.
  assert.match(guide, /\.wrap\{max-width:1100px;margin:auto;padding:0 24px\}/);
  assert.match(guide, /\.end\{margin:25px auto 76px;padding:36px;/);
  // Mobile main container has 18px side padding, so CTA keeps 18px side gutters.
  assert.match(guide, /\.wrap\{padding:0 18px\}/);
  assert.match(guide, /\.end\{width:calc\(100% - 36px\);padding:25px;margin-bottom:46px\}/);
  assert.match(guide, /<section class="end wrap" id="contact" aria-labelledby="contact-title">/);
  assert.match(guide, /<section class="section wrap" id="criteria" aria-labelledby="criteria-title">/);
  assert.match(guide, /data-channel="telegram"/);
  assert.match(guide, /data-channel="channeltalk"/);
});
