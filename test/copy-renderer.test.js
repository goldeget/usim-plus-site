import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCopy, renderParagraphs } from '../functions/_lib/copy-renderer.js';
test('copy normalizes actual and pasted line breaks', () => {
  assert.equal(normalizeCopy('  하나\r\n둘\\n셋\r넷  '), '하나\n둘\n셋\n넷');
});
test('paragraphs escape markup and preserve semantic breaks', () => {
  assert.equal(renderParagraphs('<script> & "\n둘\n \n셋'), '<p>&lt;script&gt; &amp; &quot;<br>둘</p><p>셋</p>');
  assert.equal(renderParagraphs('  '), '');
});
