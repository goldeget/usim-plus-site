import { isAdminRequest, jsonResponse, PHOTO_RETENTION_MS } from "../../_lib/applications.js";

const PAGE_SIZE = 50;
const ID_PATTERN = /^UP-[A-Za-z0-9_-]{22}$/;

function encodeCursor(row) {
  const value = JSON.stringify({ createdAt: row.created_at, id: row.id });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeCursor(value) {
  if (!value) return null;
  if (value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (!data || typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt)) || !ID_PATTERN.test(data.id || "")) return undefined;
    return { createdAt: data.createdAt, id: data.id };
  } catch { return undefined; }
}

export async function onRequest({ request, env }) {
  if (!(await isAdminRequest(request, env))) return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  if (request.method !== "GET") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.CONTENT_DB) return jsonResponse({ error: "신청 저장소가 연결되지 않았습니다." }, 503);

  const cursor = decodeCursor(new URL(request.url).searchParams.get("cursor") || "");
  if (cursor === undefined) return jsonResponse({ error: "목록 위치를 확인할 수 없습니다." }, 400);
  const cutoff = new Date(Date.now() - PHOTO_RETENTION_MS).toISOString();
  try {
    const result = await env.CONTENT_DB.prepare(
      "SELECT id, status, created_at, content_type, size_bytes FROM application_submissions WHERE status = 'pending' AND created_at > ? AND (? IS NULL OR created_at > ? OR (created_at = ? AND id > ?)) ORDER BY created_at ASC, id ASC LIMIT ?"
    ).bind(cutoff, cursor?.createdAt || null, cursor?.createdAt || null, cursor?.createdAt || null, cursor?.id || null, PAGE_SIZE + 1).all();
    const rows = result?.results || [];
    const page = rows.slice(0, PAGE_SIZE);
    const items = page.map(row => ({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      contentType: row.content_type,
      sizeBytes: row.size_bytes
    }));
    return jsonResponse({ items, nextCursor: rows.length > PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null });
  } catch {
    return jsonResponse({ error: "신청 목록을 불러오지 못했습니다." }, 503);
  }
}
