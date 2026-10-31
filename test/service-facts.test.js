import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_FACTS } from '../functions/_lib/service-facts.js';
import { loadPublicInformation } from '../functions/_lib/public-information.js';
import { DEFAULT_CONTENT, loadPublicContent, onRequest } from '../functions/api/content.js';
const database = value => ({ prepare: () => ({ bind: () => ({ first: async () => value }) }) });
test('fixed operational facts and default provenance', async () => {
  const facts = await loadPublicInformation({});
  assert.equal(facts.customerCostWon, 0);
  assert.equal(facts.separateContractRequired, false);
  assert.equal(facts.separateTelecomPaymentRequired, false);
  assert.equal(facts.definition, SERVICE_FACTS.definition);
  assert.equal(facts.contentSource, 'default');
  assert.deepEqual(facts.payout, DEFAULT_CONTENT.payout);
});
test('CMS snapshot preserves custom operational content with locked privacy', async () => {
  const content = structuredClone(DEFAULT_CONTENT);
  content.operator.company = '맞춤 운영사';
  content.copy.contactTitle = '맞춤 상담';
  content.copy.privacyCollection = '수정 금지';
  content.supportLinks.telegram = 'https://t.me/example';
  const env = { CONTENT_DB: database({ content: JSON.stringify(content), updated_at: 'saved' }) };
  const loaded = await loadPublicContent(env);
  const facts = await loadPublicInformation(env);
  assert.equal(loaded.content.copy.contactTitle, '맞춤 상담');
  assert.equal(loaded.content.copy.privacyCollection, DEFAULT_CONTENT.copy.privacyCollection);
  assert.equal(facts.operator.company, '맞춤 운영사');
  assert.equal(facts.supportLinks.telegram, 'https://t.me/example');
  assert.equal(facts.contentSource, 'cms');
  const api = await (await onRequest({ request: new Request('https://example.com/api/content'), env })).json();
  assert.deepEqual(api.payout, facts.payout);
  assert.deepEqual(api.operator, facts.operator);
});
test('storage failure allows rendered fallback while API remains unavailable', async () => {
  const env = { CONTENT_DB: { prepare() { throw new Error('offline'); } } };
  assert.equal((await loadPublicInformation(env)).contentSource, 'default');
  assert.equal((await onRequest({ request: new Request('https://example.com/api/content'), env })).status, 503);
});
test('v3 upgrades preserve public copy and links through the same loader', async () => {
  const stored = { ...structuredClone(DEFAULT_CONTENT), schemaVersion: 3, headline: '맞춤 제목', intro: '맞춤 안내' };
  stored.supportLinks.channeltalk = 'https://example.channel.io';
  const env = { CONTENT_DB: database({ content: JSON.stringify(stored), updated_at: 'saved' }) };
  const loaded = await loadPublicContent(env);
  assert.equal(loaded.contentSource, 'cms');
  assert.equal(loaded.legacyContent, true);
  assert.equal(loaded.content.schemaVersion, 4);
  assert.equal(loaded.content.headline, '맞춤 제목');
  assert.equal((await loadPublicInformation(env)).supportLinks.channeltalk, stored.supportLinks.channeltalk);
});
test('invalid records retain safe links while identifying fallback provenance', async () => {
  const env = { CONTENT_DB: database({ content: JSON.stringify({ supportLinks: { telegram: 'https://t.me/safe', line: 'javascript:bad' } }) }) };
  const facts = await loadPublicInformation(env);
  assert.equal(facts.contentSource, 'default');
  assert.equal(facts.supportLinks.telegram, 'https://t.me/safe');
  assert.equal(facts.supportLinks.line, '');
});
