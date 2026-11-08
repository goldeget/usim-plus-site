import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONTENT, validateContent, withCurrentPublicSummary } from '../functions/api/content.js';
import { buildPublicMetadata } from '../functions/index.js';

test('prepaid total remains the sum of three milestones times the case cap', () => {
  const content = structuredClone(DEFAULT_CONTENT);
  assert.equal(content.payout.milestones.reduce((sum, item) => sum + item.amount, 0), 220000);
  assert.equal(content.payout.maxCases, 3);
  assert.equal(content.payout.milestones.reduce((sum, item) => sum + item.amount, 0) * content.payout.maxCases, 660000);
  assert.equal(validateContent(content), null);
});

test('postpaid is a distinct conditional maximum, never added to prepaid payout math', () => {
  const content = structuredClone(DEFAULT_CONTENT);
  assert.equal(content.postpaid.maxTotalKrw, 1800000);
  const metadata = buildPublicMetadata(content);
  assert.match(metadata.title, /선불 최대 66만원/);
  assert.match(metadata.title, /후불 최대 180만원/);
  assert.doesNotMatch(metadata.title, /246만원/);
  content.postpaid.maxTotalKrw = 1950000;
  assert.equal(validateContent(content), null);
  assert.match(buildPublicMetadata(content).title, /후불 최대 195만원/);
});

test('postpaid missing from legacy CMS does not erase original copy', () => {
  const old = structuredClone(DEFAULT_CONTENT);
  delete old.postpaid;
  old.headline = '맞춤 혜택 안내';
  old.intro = '운영자가 작성한 별도 조건 안내';
  const current = withCurrentPublicSummary(old);
  assert.equal(current.headline, old.headline);
  assert.equal(current.intro, old.intro);
  assert.equal(current.postpaid.maxTotalKrw, 1800000);
});

test('rejects invalid postpaid caps and terms without impacting prepaid arithmetic', () => {
  const content = structuredClone(DEFAULT_CONTENT);
  content.postpaid.maxTotalKrw = -1;
  assert.match(validateContent(content), /후불/);
  content.postpaid.maxTotalKrw = 1800000;
  content.postpaid.termsNote = '';
  assert.match(validateContent(content), /후불/);
});

test('public pages and editor expose both programs and terms disclosure without combining the maxima', async () => {
  const home = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const guide = await readFile(new URL('../public/guide/index.html', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../public/admin/content.html', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../public/admin/content-editor.js', import.meta.url), 'utf8');
  assert.match(home, /id="prepaidCap">66만원/);
  assert.match(home, /id="postpaidCap">180만원/);
  assert.match(home, /별도 프로그램이며 최대액을 합산/);
  assert.match(guide, /data-postpaid-total>180만원/);
  assert.match(guide, /data-postpaid-terms/);
  assert.match(admin, /id="postpaidMax"/);
  assert.match(admin, /id="postpaidTerms"/);
  assert.match(editor, /postpaid: readPostpaid\(\)/);
});

test('upgrades only exact former production defaults to separate benefit copy', () => {
  const old = structuredClone(DEFAULT_CONTENT);
  old.headline = '몰랐던 유심 혜택\n최대 {{MAX_TOTAL}}';
  old.intro = '유심으로 받을 수 있는 혜택을 확인하고, 희망하면 진행을 도와드립니다.\n3일·15일·30일 유지 조건 충족 시 최대 {{MAX_TOTAL}} 지급 대상입니다.\n자세한 혜택·조건은 텔레그램·채널톡 상담으로 안내합니다.';
  old.seo.title = '클라임유심 | 유심 혜택 · 유심 혜택 확인 · 최대 {{MAX_TOTAL}} | 서울평가정보㈜';
  old.seo.socialTitle = old.seo.title;
  old.copy.footerTerms = '몰랐던 유심 혜택 · 최대 {{MAX_TOTAL}}\n자세한 혜택·조건은 텔레그램·채널톡 상담';
  const current = withCurrentPublicSummary(old);
  assert.equal(current.headline, DEFAULT_CONTENT.headline);
  assert.equal(current.intro, DEFAULT_CONTENT.intro);
  assert.equal(current.seo.title, DEFAULT_CONTENT.seo.title);
  assert.equal(current.seo.socialTitle, DEFAULT_CONTENT.seo.socialTitle);
  assert.equal(current.copy.footerTerms, DEFAULT_CONTENT.copy.footerTerms);
  assert.equal(current.postpaid.maxTotalKrw, 1800000);
});
