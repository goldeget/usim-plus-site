import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  normalizeReviewBody,
  reviewHashes,
  reviewTextContainsInternalId
} from "./reviews.js";

/** Published reviews moved to "today" on each Asia/Seoul calendar day. */
export const DAILY_REVIEW_REFRESH_LIMIT = 50;

const PAGE_SIZE = 80;
const MAX_SCAN = 400;

const WEEKDAY_KO = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" };
const MINUTE_STAMP_RE = /\s*\d{1,2}\s*분경\s*/g;
const YEAR_MONTH_DAY_RE = /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g;
const MONTH_DAY_RE = /\d{1,2}\s*월\s*\d{1,2}\s*일/g;
const WEEKDAY_RE = /(?:일|월|화|수|목|금|토)요일/g;

/** @param {Date} date */
export function kstCalendarParts(date) {
  const bag = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hourCycle: "h23"
  }).formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const digits = value => Number(String(value ?? "").replace(/[^\d]/g, ""));
  return {
    year: digits(bag.year),
    month: digits(bag.month),
    day: digits(bag.day),
    weekday: WEEKDAY_KO[bag.weekday] || bag.weekday
  };
}

/** @param {Date} date */
export function kstDateKey(date) {
  const parts = kstCalendarParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Point calendar phrases at `when` in Asia/Seoul and drop minute stamps.
 * Time-of-day words ("오전에", "퇴근 후") and the rest of the story stay.
 * @param {string} body
 * @param {Date|string|number} when
 */
export function rewriteReviewDatePhrase(body, when) {
  const instant = when instanceof Date ? when : new Date(when);
  const kst = kstCalendarParts(instant);
  const md = `${kst.month}월 ${kst.day}일`;
  const ymd = `${kst.year}년 ${md}`;
  const weekday = `${kst.weekday}요일`;
  let text = String(body ?? "");
  text = text.replace(MINUTE_STAMP_RE, " ");
  text = text.replace(YEAR_MONTH_DAY_RE, ymd);
  text = text.replace(MONTH_DAY_RE, md);
  text = text.replace(WEEKDAY_RE, weekday);
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function changes(result) {
  return Number(result?.meta?.changes ?? 0);
}

async function restoreReview(db, bucket, row, originalText) {
  await db.prepare(
    `UPDATE reviews SET
      published_at = ?, snippet = ?, snippet_sha256 = ?, body_sha256 = ?,
      body_norm_sha256 = ?, body_byte_length = ?, refreshed_on = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    row.published_at,
    row.snippet,
    row.snippet_sha256,
    row.body_sha256,
    row.body_norm_sha256,
    row.body_byte_length,
    row.refreshed_on ?? null,
    row.updated_at,
    row.id
  ).run();
  if (originalText != null) {
    await bucket.put(row.body_r2_key, originalText, {
      httpMetadata: { contentType: "application/json; charset=utf-8" }
    });
  }
}

async function applyReviewRefresh({ db, bucket, row, when, kstDate, nowIso }) {
  const object = await bucket.get(row.body_r2_key);
  if (!object) return { ok: false, reason: "missing_body" };
  const originalText = await new Response(object.body).text();
  let stored;
  try {
    stored = JSON.parse(originalText);
  } catch {
    return { ok: false, reason: "bad_body" };
  }
  const raw = typeof stored?.body === "string" ? stored.body : "";
  if (!raw) return { ok: false, reason: "missing_body" };

  const body = normalizeReviewBody(rewriteReviewDatePhrase(raw, when));
  if (reviewTextContainsInternalId(body)) return { ok: false, reason: "internal_id" };
  if (/\d+\s*분경/.test(body)) return { ok: false, reason: "minute_stamp" };
  if (body.length < REVIEW_BODY_MIN || body.length > REVIEW_BODY_MAX) return { ok: false, reason: "invalid_length" };

  const hashes = await reviewHashes(body);
  const conflict = await db.prepare(
    `SELECT id FROM reviews
     WHERE id != ? AND (body_sha256 = ? OR body_norm_sha256 = ? OR snippet_sha256 = ?)
     LIMIT 1`
  ).bind(row.id, hashes.body_sha256, hashes.body_norm_sha256, hashes.snippet_sha256).first();
  if (conflict?.id) return { ok: false, reason: "duplicate" };

  const publishedAt = nowIso;
  try {
    const outcome = await db.prepare(
      `UPDATE reviews SET
        published_at = ?, snippet = ?, snippet_sha256 = ?, body_sha256 = ?,
        body_norm_sha256 = ?, body_byte_length = ?, refreshed_on = ?, updated_at = ?
       WHERE id = ? AND status = 'published' AND (refreshed_on IS NULL OR refreshed_on != ?)`
    ).bind(
      publishedAt,
      hashes.snippet,
      hashes.snippet_sha256,
      hashes.body_sha256,
      hashes.body_norm_sha256,
      hashes.body_byte_length,
      kstDate,
      nowIso,
      row.id,
      kstDate
    ).run();
    if (!changes(outcome)) return { ok: false, reason: "not_updated" };
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error?.message || error))) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }

  const payload = JSON.stringify({
    id: row.id,
    body,
    rating: row.rating,
    publishedAt,
    importedAt: typeof stored.importedAt === "string" ? stored.importedAt : nowIso
  });
  try {
    await bucket.put(row.body_r2_key, payload, {
      httpMetadata: { contentType: "application/json; charset=utf-8" }
    });
  } catch (error) {
    await restoreReview(db, bucket, row, null);
    throw error;
  }

  return {
    ok: true,
    rollback: () => restoreReview(db, bucket, row, originalText)
  };
}

/**
 * Move up to 50 published reviews that were not already refreshed on this
 * Seoul calendar day. Oldest published_at first. Ratings, names, and boosts stay.
 * A second call the same day refreshes 0 once the daily count reaches 50.
 * Fewer than 50 eligible rows refreshes only those rows and does not throw.
 */
export async function refreshPublishedReviews({ db, bucket, now = new Date() } = {}) {
  if (!db || !bucket) return { updated: 0, skipped: 0, ids: [], kstDate: null };
  const when = now instanceof Date ? now : new Date(now);
  const kstDate = kstDateKey(when);
  const nowIso = when.toISOString();
  const limit = DAILY_REVIEW_REFRESH_LIMIT;

  await db.prepare(
    `INSERT INTO review_refresh_days (kst_date, refreshed_count, updated_at)
     VALUES (?, 0, ?)
     ON CONFLICT(kst_date) DO NOTHING`
  ).bind(kstDate, nowIso).run();

  const day = await db.prepare(
    "SELECT refreshed_count FROM review_refresh_days WHERE kst_date = ?"
  ).bind(kstDate).first();
  let done = Number(day?.refreshed_count || 0);
  if (done >= limit) return { updated: 0, skipped: 0, ids: [], kstDate };

  const ids = [];
  let skipped = 0;
  let scanned = 0;
  let cursorPublishedAt = "";
  let cursorId = "";
  let stop = false;

  while (!stop && done < limit && scanned < MAX_SCAN) {
    const listed = await db.prepare(
      `SELECT id, published_at, rating, snippet, snippet_sha256, body_sha256, body_norm_sha256,
              body_byte_length, body_r2_key, refreshed_on, updated_at
       FROM reviews
       WHERE status = 'published'
         AND (refreshed_on IS NULL OR refreshed_on != ?)
         AND (published_at > ? OR (published_at = ? AND id > ?))
       ORDER BY published_at ASC, id ASC
       LIMIT ?`
    ).bind(kstDate, cursorPublishedAt, cursorPublishedAt, cursorId, PAGE_SIZE).all();
    const rows = listed?.results || [];
    if (!rows.length) break;

    for (const row of rows) {
      cursorPublishedAt = row.published_at;
      cursorId = row.id;
      if (done >= limit || scanned >= MAX_SCAN) {
        stop = true;
        break;
      }
      scanned += 1;
      const applied = await applyReviewRefresh({ db, bucket, row, when, kstDate, nowIso });
      if (!applied.ok) {
        skipped += 1;
        continue;
      }
      const bumped = await db.prepare(
        `UPDATE review_refresh_days
         SET refreshed_count = refreshed_count + 1, updated_at = ?
         WHERE kst_date = ? AND refreshed_count < ?`
      ).bind(nowIso, kstDate, limit).run();
      if (!changes(bumped)) {
        await applied.rollback();
        stop = true;
        break;
      }
      done += 1;
      ids.push(row.id);
    }
    if (rows.length < PAGE_SIZE) break;
  }

  return { updated: ids.length, skipped, ids, kstDate };
}
