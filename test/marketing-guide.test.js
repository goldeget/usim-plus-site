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
  assert.match(guide, /<h1>몰랐던 유심 혜택으로 <strong>최대 66만원<\/strong><\/h1>/);
  assert.doesNotMatch(guide, /자금이 급할 때|급전|폰깡|통신혜택|내구재|3일|15일|30일/);
  assert.match(guide, /자세한 혜택·조건은 텔레그램·채널톡 상담으로 안내합니다/);
});

test('benefits guide stays brief and defers conditions to chat', () => {
  assert.doesNotMatch(guide, /data-total|data-milestones|content\.payout|stage\.days/);
  assert.ok(guide.length < 14000);
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
  assert.match(sitemap, /<loc>https:\/\/climekr\.com\/guide\/<\/loc>/);
  assert.doesNotMatch(sitemap, /climekr\.com\/links/);
});

test('guide has no FAQ section and keeps the consultation CTA', () => {
  assert.doesNotMatch(guide, /자주 묻는 질문|faq-title|<details|<summary/);
  assert.match(guide, /data-channel="telegram"/);
  assert.match(guide, /data-channel="channeltalk"/);
});

test('does not show unsolicited five-point pre-consultation checklist', () => {
  assert.doesNotMatch(guide, /상담 전에 확인할 다섯 가지|check-title|class="checklist"/);
  assert.equal(guide.includes('.checklist'), false);
});

test('consultation CTA keeps desktop and mobile gutters', () => {
  assert.match(guide, /\.wrap\{max-width:1100px;margin:auto;padding:0 24px\}/);
  assert.match(guide, /\.wrap\{padding:0 18px\}/);
  assert.match(guide, /id="contact"/);
});
