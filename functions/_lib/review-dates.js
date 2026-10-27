/**
 * Reader-side review dates. The public site does not write to D1.
 *
 * Each stored row has a stable slot (0 = oldest base, 9999 = newest base)
 * and a base instant baked into the static JSON. The body keeps that base
 * calendar phrase. At read time, 50 slots are shown as "today":
 *
 *   dayIndex = Seoul civil days since 1970-01-01
 *   cycle    = 10000
 *   window   = 50
 *   today iff (dayIndex + slot) % cycle < window
 *
 * That selects 50 consecutive slots, wrapping past 9999:
 *   start = (cycle - (dayIndex % cycle)) % cycle
 *   slots = start, start+1, … (mod cycle), 50 of them
 *
 * The same Seoul calendar day always yields the same slots. The next Seoul
 * day shifts the window by one slot (49 stay, one leaves, one enters).
 * Card `publishedAt` and the 년/월/일 words in the text are both the display
 * instant, so they match. Time-of-day words ("오전에") stay with the base clock.
 */

const WEEKDAY_KO = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" };
const MINUTE_STAMP_RE = /\s*\d{1,2}\s*분경\s*/g;
const YEAR_MONTH_DAY_RE = /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g;
const MONTH_DAY_RE = /\d{1,2}\s*월\s*\d{1,2}\s*일/g;
const WEEKDAY_RE = /(?:일|월|화|수|목|금|토)요일/g;
const DURATION_RE = /(?:3|15|30)일\s*유지/g;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

export const REVIEW_SLOT_COUNT = 10_000;
export const DAILY_TODAY_COUNT = 50;
export const REVIEW_CHUNK_SIZE = 200;
export const REVIEW_CHUNK_COUNT = REVIEW_SLOT_COUNT / REVIEW_CHUNK_SIZE;

export const REVIEW_META_PATH = "/reviews/data/meta.json";
export const REVIEW_RATING3_PATH = "/reviews/data/rating-3.json";

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

/** Hour/minute/second in Asia/Seoul. Milliseconds stay on the UTC instant. */
export function kstClockParts(date) {
  const instant = date instanceof Date ? date : new Date(date);
  const bag = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
    hourCycle: "h23"
  }).formatToParts(instant)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const digits = value => Number(String(value ?? "").replace(/[^\d]/g, ""));
  let hour = digits(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: digits(bag.year),
    month: digits(bag.month),
    day: digits(bag.day),
    hour,
    minute: digits(bag.minute),
    second: digits(bag.second),
    ms: instant.getUTCMilliseconds(),
    weekday: WEEKDAY_KO[bag.weekday] || bag.weekday
  };
}

/** @param {Date|string|number} date */
export function kstDateKey(date) {
  const instant = date instanceof Date ? date : new Date(date);
  const parts = kstCalendarParts(instant);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Seoul civil day count. Same calendar day → same index, including across UTC midnight. */
export function seoulDayIndex(date) {
  const instant = date instanceof Date ? date : new Date(date);
  const parts = kstCalendarParts(instant);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

export function seoulWallToUtc(year, month, day, hour = 0, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - SEOUL_OFFSET_MS);
}

/** Keep the base clock, move the calendar day to `daySource` in Asia/Seoul. */
export function moveToSeoulDay(clockSource, daySource) {
  const clock = kstClockParts(clockSource);
  const day = kstCalendarParts(daySource instanceof Date ? daySource : new Date(daySource));
  return seoulWallToUtc(day.year, day.month, day.day, clock.hour, clock.minute, clock.second, clock.ms);
}

/** Today-window slots appear to roll in across the KST day: ~50/day, one every 28m48s. */
export function dailySlotInstant(slot, dayIndex) {
  const s = Number(slot);
  if (!Number.isInteger(s) || s < 0 || s >= REVIEW_SLOT_COUNT) return null;
  const rank = (dayIndex + s) % REVIEW_SLOT_COUNT;
  if (rank >= DAILY_TODAY_COUNT) return null;
  const ms = rank * (86_400_000 / DAILY_TODAY_COUNT);
  const utcMs = dayIndex * 86_400_000 + ms - SEOUL_OFFSET_MS;
  return new Date(utcMs);
}

export function seoulTodayContext(today = new Date()) {
  const todayDate = today instanceof Date ? today : new Date(today);
  return {
    todayDate,
    dayIndex: seoulDayIndex(todayDate),
    todayKey: kstDateKey(todayDate)
  };
}

export function isTodaySlotOnDay(slot, dayIndex) {
  const s = Number(slot);
  if (!Number.isInteger(s) || s < 0 || s >= REVIEW_SLOT_COUNT) return false;
  return ((dayIndex + s) % REVIEW_SLOT_COUNT) < DAILY_TODAY_COUNT;
}

/** @param {number} slot @param {Date|string|number} today */
export function isTodaySlot(slot, today) {
  return isTodaySlotOnDay(slot, seoulDayIndex(today));
}

/** The 50 slots whose display date is today. Stable for one Seoul calendar day. */
export function todayWindowSlots(today) {
  const dayIndex = seoulDayIndex(today);
  const start = (REVIEW_SLOT_COUNT - (dayIndex % REVIEW_SLOT_COUNT)) % REVIEW_SLOT_COUNT;
  const slots = new Array(DAILY_TODAY_COUNT);
  for (let i = 0; i < DAILY_TODAY_COUNT; i += 1) slots[i] = (start + i) % REVIEW_SLOT_COUNT;
  return slots;
}

/** Today slots that have appeared by this instant, oldest first. */
export function releasedTodaySlots(today) {
  const todayDate = today instanceof Date ? today : new Date(today);
  const nowMs = todayDate.getTime();
  return todayWindowSlots(todayDate).filter(slot => {
    const when = dailySlotInstant(slot, seoulDayIndex(todayDate));
    return when && when.getTime() <= nowMs;
  });
}

/**
 * Display instant for a slot.
 * Window slots use today's Seoul calendar date and the base clock.
 * Every other slot keeps its stored base instant.
 * @param {number} slot
 * @param {Date|string|number} today
 * @param {Date|string|number} basePublishedAt stable base instant stored with the slot
 */
export function displaySeoulDate(slot, today, basePublishedAt) {
  const todayDate = today instanceof Date ? today : new Date(today);
  const base = basePublishedAt instanceof Date ? basePublishedAt : new Date(basePublishedAt);
  if (isTodaySlot(slot, todayDate)) {
    return dailySlotInstant(slot, seoulDayIndex(todayDate)) || moveToSeoulDay(base, todayDate);
  }
  return new Date(base.getTime());
}

/**
 * Point calendar phrases at `when` in Asia/Seoul and drop minute stamps.
 * Time-of-day words ("오전에", "퇴근하고") and the rest of the story stay.
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

/**
 * Full-body check: the text's calendar words are `date` in Asia/Seoul.
 * @returns {string|null} mismatch code
 */
export function reviewDateMismatch(text, date) {
  const parts = kstCalendarParts(date instanceof Date ? date : new Date(date));
  const body = String(text ?? "");
  if (/\d+\s*분경/.test(body)) return "minute_stamp";
  if (/corpus-\d{5}/i.test(body)) return "corpus_id";
  for (const match of body.matchAll(/(\d{4})년/g)) {
    if (Number(match[1]) !== parts.year) return "year";
  }
  for (const match of body.matchAll(/(\d{1,2})월\s*(\d{1,2})일/g)) {
    if (Number(match[1]) !== parts.month || Number(match[2]) !== parts.day) return "month_day";
  }
  for (const match of body.matchAll(/(일|월|화|수|목|금|토)요일/g)) {
    if (match[1] !== parts.weekday) return "weekday";
  }
  const stripped = body.replace(DURATION_RE, "").replace(MONTH_DAY_RE, "");
  if (/(\d{1,2})일/.test(stripped)) return "stray_day";
  if (!new RegExp(`${parts.month}월\\s*${parts.day}일`).test(body)) return "missing_date";
  return null;
}

export function reviewIdForSlot(slot) {
  return `rv${String(slot).padStart(4, "0")}`;
}

export function slotFromReviewId(id) {
  const match = /^rv(\d{4})$/.exec(String(id ?? ""));
  if (!match) return null;
  const slot = Number(match[1]);
  if (slot >= REVIEW_SLOT_COUNT) return null;
  return slot;
}

export function chunkIndexForSlot(slot) {
  return Math.floor(Number(slot) / REVIEW_CHUNK_SIZE);
}

export function listChunkPath(chunk) {
  return `/reviews/data/list/c${String(chunk).padStart(3, "0")}.json`;
}

export function bodyChunkPath(chunk) {
  return `/reviews/data/bodies/c${String(chunk).padStart(3, "0")}.json`;
}

/**
 * Public list/detail shape. Rewrites snippet/body only when the display
 * calendar day differs from the stored base day.
 */
export function presentReview(record, today, { includeBody = false, context = null } = {}) {
  const ctx = context || seoulTodayContext(today);
  const baseMs = Date.parse(record.basePublishedAt);
  let publishedAt = record.basePublishedAt;
  let displayed = null;
  if (isTodaySlotOnDay(record.slot, ctx.dayIndex)) {
    displayed = dailySlotInstant(record.slot, ctx.dayIndex) || moveToSeoulDay(record.basePublishedAt, ctx.todayDate);
    if (displayed.getTime() !== baseMs) publishedAt = displayed.toISOString();
  }
  let shifted = publishedAt !== record.basePublishedAt;
  let snippet = record.snippet;
  let body = includeBody ? record.body : undefined;
  if (shifted) {
    snippet = rewriteReviewDatePhrase(snippet, displayed);
    if (includeBody) body = rewriteReviewDatePhrase(body, displayed);
  }
  const item = {
    id: record.id,
    publishedAt,
    rating: record.rating,
    snippet,
    displayName: record.displayName,
    tags: record.tags && typeof record.tags === "object" ? { ...record.tags } : {},
    featured: Boolean(record.featured)
  };
  if (includeBody) item.body = body;
  return item;
}

export function comparePublishedDesc(a, b) {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

/** True when `item` is strictly older than a desc cursor (publishedAt, id). */
export function isOlderThanCursor(item, cursor) {
  if (item.publishedAt !== cursor.publishedAt) return item.publishedAt < cursor.publishedAt;
  return item.id < cursor.id;
}
