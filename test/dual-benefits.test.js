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
