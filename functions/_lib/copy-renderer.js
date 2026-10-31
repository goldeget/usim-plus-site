// Plain copy fields only. Do not apply to URLs, code, or serialized JSON:
// literal backslash-n sequences in those formats are intentionally ambiguous.
export function normalizeCopy(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').replaceAll('\\n', '\n').trim();
}

const escapeHtml = text => text.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

// Returns complete paragraphs; the caller must use a block container, not <p>.
export function renderParagraphs(text) {
  const normalized = normalizeCopy(text);
  if (!normalized) return '';
  return normalized.split(/\n[\t ]*\n(?:[\t ]*\n)*/)
    .map(paragraph => `<p>${escapeHtml(paragraph.trim()).replaceAll('\n', '<br>')}</p>`).join('');
}
