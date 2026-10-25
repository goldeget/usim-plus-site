import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const guide = read('../public/guide/index.html');
const social = read('../public/links/index.html');
const home = read('../public/index.html');
const sitemap = read('../public/sitemap.xml');

test('benefits guide has unique self-canonical and describes actual service', () => {
  assert.match(guide, /<title>자금이 급할 때 알아둘 유심 개통 혜택과 지급 조건/);
  assert.match(guide, /rel="canonical" href="https:\/\/climekr\.com\/guide\/"/);
  assert.match(guide, /대출·대부·당일대출 서비스가 아니며/);
  assert.match(guide, /혜택은 상담이나 개통 직후 지급되는 것이 아니며/);
  assert.match(guide, /개통비·월 통신요금·유지비·위약금/);
  assert.match(guide, /운영사가 제공한 조건은 고객 부담금 0원/);
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
  assert.match(home, /href="\/links\/"/);
  assert.match(sitemap, /<loc>https:\/\/climekr\.com\/guide\/<\/loc>/);
  assert.doesNotMatch(sitemap, /climekr\.com\/links/);
});

test('clarifies that a rejected loan does not bar consultation or benefit application', () => {
  assert.match(guide, /대출이 거절되어도 CLIME 유심 혜택을 신청할 수 있나요\?/);
  assert.match(guide, /대출이 거절되었더라도 상담과 참여 신청이 가능합니다/);
  assert.match(guide, /대출 거절만으로 신청이 제한되지는 않습니다/);
  assert.match(guide, /혜택 지급은 본인 명의 회선 개통과 3일·15일·30일 유지/);
  assert.doesNotMatch(guide, /대출이 거절되었는데 유심 혜택은 무조건 가능한가요/);
  assert.doesNotMatch(guide, /모든 신청자에게 무조건 지급/);
});
