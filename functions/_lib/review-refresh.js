import {
  kstCalendarParts,
  kstDateKey,
  rewriteReviewDatePhrase
} from "./review-dates.js";
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  normalizeReviewBody,
  reviewHashes,
  reviewTextContainsInternalId
} from "./reviews.js";

export { kstCalendarParts, kstDateKey, rewriteReviewDatePhrase };

/** Published reviews moved to "today" on each Asia/Seoul calendar day. */
export const DAILY_REVIEW_REFRESH_LIMIT = 50;

const PAGE_SIZE = 80;
const MAX_SCAN = 400;

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
