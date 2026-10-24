const METADATA_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
const PHOTO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DUPLICATE_PAGE_SIZE = 50;
const ID_PATTERN = /^UP-[A-Za-z0-9_-]{22}$/;

export const DUPLICATE_REVIEW_NOTICE = "같은 사진 파일 또는 같은 인터넷 접속에서 접수된 기록이 함께 표시됩니다. 같은 인터넷을 쓰는 다른 사람일 수 있으니 이 표시만으로 동일인이나 부정 신청을 단정하지 말고, 사진과 접수 이력을 함께 확인하세요.";

function encodeCursor(row) {
  const value = JSON.stringify({ createdAt: row.created_at, id: row.id });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeCursor(value) {
  if (typeof value !== "string" || !value || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (!data || typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt)) || !ID_PATTERN.test(data.id || "")) return null;
    return { createdAt: data.createdAt, id: data.id };
  } catch { return null; }
}

function publicApplication(row, photoCutoff) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || null,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    photoExpired: row.status === "pending" ? row.created_at <= photoCutoff : (row.reviewed_at || "") <= photoCutoff
  };
}

export async function loadDuplicateGroups(env, now = Date.now()) {
  const cutoff = new Date(now - METADATA_RETENTION_MS).toISOString();
  const result = await env.CONTENT_DB.prepare(
    "SELECT type, fingerprint, COUNT(*) AS count, MAX(created_at) AS latest_created_at, MAX(id COLLATE BINARY) AS reference_id FROM (SELECT 'same_ip' AS type, source_ip_hash AS fingerprint, id, created_at FROM application_submissions WHERE source_ip_hash IS NOT NULL AND ((status = 'pending' AND created_at > ?) OR (status IN ('approved', 'rejected') AND reviewed_at > ?)) UNION ALL SELECT 'same_image' AS type, image_hash AS fingerprint, id, created_at FROM application_submissions WHERE image_hash IS NOT NULL AND ((status = 'pending' AND created_at > ?) OR (status IN ('approved', 'rejected') AND reviewed_at > ?))) AS review_signals GROUP BY type, fingerprint HAVING COUNT(*) > 1 ORDER BY latest_created_at DESC, reference_id COLLATE BINARY DESC"
  ).bind(cutoff, cutoff, cutoff, cutoff).all();
  const rows = result?.results || [];
  return {
    groups: rows.map(row => ({
      type: row.type,
      label: row.type === "same_ip" ? "같은 인터넷 접속 신호" : "같은 사진 파일",
      count: Number(row.count),
      referenceId: row.reference_id,
      applications: [],
      applicationIds: [],
      nextCursor: null
    })),
    truncated: false
  };
}

export async function loadDuplicateGroupPage(env, { type, referenceId, cursor: cursorValue, now = Date.now() }) {
  if (!["same_ip", "same_image"].includes(type) || !ID_PATTERN.test(referenceId || "")) return { error: "중복 접수 묶음을 확인할 수 없습니다.", status: 400 };
  const cursor = cursorValue ? decodeCursor(cursorValue) : null;
  if (cursorValue && !cursor) return { error: "목록 위치를 확인할 수 없습니다.", status: 400 };
  const column = type === "same_ip" ? "source_ip_hash" : "image_hash";
  const cutoff = new Date(now - METADATA_RETENTION_MS).toISOString();
  const photoCutoff = new Date(now - PHOTO_RETENTION_MS).toISOString();
  const reference = await env.CONTENT_DB.prepare(`SELECT ${column} FROM application_submissions WHERE id = ?`).bind(referenceId).first();
  const fingerprint = reference?.[column];
  if (!fingerprint) return { error: "중복 접수 묶음을 찾을 수 없습니다.", status: 404 };
  const cursorCondition = cursor ? "AND (created_at < ? OR (created_at = ? AND id COLLATE BINARY < ?))" : "";
  const cursorValues = cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : [];
  const result = await env.CONTENT_DB.prepare(
    `SELECT id, status, created_at, reviewed_at, content_type, size_bytes FROM application_submissions WHERE ${column} = ? AND ((status = 'pending' AND created_at > ?) OR (status IN ('approved', 'rejected') AND reviewed_at > ?)) ${cursorCondition} ORDER BY created_at DESC, id COLLATE BINARY DESC LIMIT ?`
  ).bind(fingerprint, cutoff, cutoff, ...cursorValues, DUPLICATE_PAGE_SIZE + 1).all();
  const rows = result?.results || [];
  const page = rows.slice(0, DUPLICATE_PAGE_SIZE);
  return {
    applications: page.map(row => publicApplication(row, photoCutoff)),
    nextCursor: rows.length > DUPLICATE_PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null
  };
}

export async function loadApplicationDuplicateSignals(env, applicationIds, now = Date.now()) {
  if (!Array.isArray(applicationIds) || !applicationIds.length || applicationIds.length > 50 || applicationIds.some(id => !ID_PATTERN.test(id || ""))) {
    return { error: "확인할 접수번호를 살펴봐 주세요.", status: 400 };
  }
  const ids = [...new Set(applicationIds)];
  const cutoff = new Date(now - METADATA_RETENTION_MS).toISOString();
  const idPlaceholders = ids.map(() => "?").join(",");
  const selectedResult = await env.CONTENT_DB.prepare(
    `SELECT id, status, created_at, reviewed_at, source_ip_hash, image_hash FROM application_submissions WHERE id IN (${idPlaceholders})`
  ).bind(...ids).all();
  const selectedRows = (selectedResult?.results || []).filter(row =>
    (row.status === "pending" && row.created_at > cutoff) ||
    (["approved", "rejected"].includes(row.status) && (row.reviewed_at || "") > cutoff)
  );
  const selectedById = new Map(selectedRows.map(row => [row.id, row]));
  const ipHashes = [...new Set(selectedRows.map(row => row.source_ip_hash).filter(Boolean))];
  const imageHashes = [...new Set(selectedRows.map(row => row.image_hash).filter(Boolean))];
  const signalsById = new Map(ids.map(id => [id, []]));
  if (ipHashes.length || imageHashes.length) {
    const ipClause = ipHashes.length ? `source_ip_hash IN (${ipHashes.map(() => "?").join(",")})` : "0";
    const imageClause = imageHashes.length ? `image_hash IN (${imageHashes.map(() => "?").join(",")})` : "0";
    const relatedResult = await env.CONTENT_DB.prepare(
      `SELECT id, source_ip_hash, image_hash FROM application_submissions WHERE (${ipClause} OR ${imageClause}) AND ((status = 'pending' AND created_at > ?) OR (status IN ('approved', 'rejected') AND reviewed_at > ?))`
    ).bind(...ipHashes, ...imageHashes, cutoff, cutoff).all();
    const relatedRows = relatedResult?.results || [];
    for (const id of ids) {
      const selected = selectedById.get(id);
      if (!selected) continue;
      const signals = signalsById.get(id);
      if (selected.source_ip_hash && relatedRows.some(row => row.id !== id && row.source_ip_hash === selected.source_ip_hash)) signals.push("same_ip");
      if (selected.image_hash && relatedRows.some(row => row.id !== id && row.image_hash === selected.image_hash)) signals.push("same_image");
    }
  }
  return { items: ids.map(id => ({ id, signals: signalsById.get(id) })) };
}
