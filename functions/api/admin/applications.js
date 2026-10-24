import { isAdminRequest, jsonResponse, PHOTO_RETENTION_MS } from "../../_lib/applications.js";

const PAGE_SIZE = 50;
const ID_PATTERN = /^UP-[A-Za-z0-9_-]{22}$/;

function encodeCursor(row) {
  const value = JSON.stringify({ sortAt: row.sort_at || row.created_at, id: row.id });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeCursor(value) {
  if (!value) return null;
  if (value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (!data || typeof data !== "object") return undefined;
    const sortAt = data.sortAt || data.createdAt;
    if (typeof sortAt !== "string" || !Number.isFinite(Date.parse(sortAt)) || !ID_PATTERN.test(data.id || "")) return undefined;
    return { sortAt, id: data.id };
  } catch { return undefined; }
}

export async function onRequest({ request, env }) {
  if (!(await isAdminRequest(request, env))) return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  if (request.method !== "GET") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.CONTENT_DB) return jsonResponse({ error: "신청 저장소가 연결되지 않았습니다." }, 503);

  const params = new URL(request.url).searchParams;
  const status = params.get("status") || "pending";
  if (!["pending", "approved", "rejected", "all"].includes(status)) return jsonResponse({ error: "신청 상태 필터를 확인해 주세요." }, 400);
  const pendingCutoff = new Date(Date.now() - PHOTO_RETENTION_MS).toISOString();
  const reviewedCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const historyPendingCutoff = reviewedCutoff;
  const selectedId = params.get("id");
  if (selectedId !== null) {
    if (status !== "pending" || !ID_PATTERN.test(selectedId)) return jsonResponse({ error: "검토할 접수번호를 확인해 주세요." }, 400);
    try {
      const row = await env.CONTENT_DB.prepare(
        "SELECT id, status, created_at, content_type, size_bytes FROM application_submissions WHERE id = ? AND status = 'pending' AND created_at > ?"
      ).bind(selectedId, pendingCutoff).first();
      if (!row) return jsonResponse({ error: "해당 접수를 찾을 수 없거나 사진 보관 기간이 끝났습니다." }, 404);
      return jsonResponse({ items: [{ id: row.id, status: row.status, createdAt: row.created_at, contentType: row.content_type, sizeBytes: row.size_bytes }], nextCursor: null });
    } catch {
      return jsonResponse({ error: "선택한 접수 정보를 불러오지 못했습니다." }, 503);
    }
  }
  const cursor = decodeCursor(params.get("cursor") || "");
  if (cursor === undefined) return jsonResponse({ error: "목록 위치를 확인할 수 없습니다." }, 400);
  try {
    const result = status === "pending"
      ? await env.CONTENT_DB.prepare(
          "SELECT id, status, created_at, content_type, size_bytes FROM application_submissions WHERE status = 'pending' AND created_at > ? AND (? IS NULL OR created_at > ? OR (created_at = ? AND id > ?)) ORDER BY created_at ASC, id ASC LIMIT ?"
        ).bind(pendingCutoff, cursor?.sortAt || null, cursor?.sortAt || null, cursor?.sortAt || null, cursor?.id || null, PAGE_SIZE + 1).all()
      : await env.CONTENT_DB.prepare(
          "SELECT id, status, created_at, reviewed_at, content_type, size_bytes, COALESCE(reviewed_at, created_at) AS sort_at FROM application_submissions WHERE ((? = 'all' AND ((status = 'pending' AND created_at > ?) OR (status IN ('approved', 'rejected') AND reviewed_at > ?))) OR (status = 'approved' AND ? = 'approved' AND reviewed_at > ?) OR (status = 'rejected' AND ? = 'rejected' AND reviewed_at > ?)) AND (? IS NULL OR COALESCE(reviewed_at, created_at) < ? OR (COALESCE(reviewed_at, created_at) = ? AND id < ?)) ORDER BY COALESCE(reviewed_at, created_at) DESC, id DESC LIMIT ?"
        ).bind(status, historyPendingCutoff, reviewedCutoff, status, reviewedCutoff, status, reviewedCutoff, cursor?.sortAt || null, cursor?.sortAt || null, cursor?.sortAt || null, cursor?.id || null, PAGE_SIZE + 1).all();
    const rows = result?.results || [];
    const page = rows.slice(0, PAGE_SIZE);
    const items = page.map(row => ({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      ...(row.status === "pending" && row.created_at <= pendingCutoff ? { photoExpired: true } : {})
    }));
    return jsonResponse({ items, nextCursor: rows.length > PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null });
  } catch {
    return jsonResponse({ error: "신청 목록을 불러오지 못했습니다." }, 503);
  }
}
