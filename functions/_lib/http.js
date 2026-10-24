export async function readBoundedRequestBody(request, maxBytes) {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > maxBytes)) {
    return { bytes: null, tooLarge: true };
  }

  const reader = request.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(0), tooLarge: false };

  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      try { await reader.cancel(); } catch {}
      return { bytes: null, tooLarge: true };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, tooLarge: false };
}

export function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left ?? ""));
  const b = new TextEncoder().encode(String(right ?? ""));
  const maxLength = 512;
  if (a.length > maxLength || b.length > maxLength) return false;
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < maxLength; i += 1) mismatch |= (a[i] || 0) ^ (b[i] || 0);
  return mismatch === 0;
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}
