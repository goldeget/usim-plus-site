/**
 * Public review reads. Pages Functions load generated JSON from the site
 * assets. D1 is not consulted, so a partial or empty reviews table does not
 * change /reviews/, the home strip, or /api/reviews*.
 */
import { encodeCursor } from "./reviews.js";
import {
  REVIEW_CHUNK_COUNT,
  REVIEW_CHUNK_SIZE,
  REVIEW_META_PATH,
  REVIEW_RATING3_PATH,
  REVIEW_SLOT_COUNT,
  bodyChunkPath,
  chunkIndexForSlot,
  comparePublishedDesc,
  isOlderThanCursor,
  isTodaySlotOnDay,
  listChunkPath,
  presentReview,
  seoulTodayContext,
  slotFromReviewId,
  todayWindowSlots
} from "./review-dates.js";

const cache = {
  meta: null,
  metaPromise: null,
  rating3: null,
  rating3Promise: null,
  list: new Map(),
  listPromise: new Map(),
  bodies: new Map(),
  bodyPromise: new Map()
};

export function resetReviewStaticCache() {
  cache.meta = null;
  cache.metaPromise = null;
  cache.rating3 = null;
  cache.rating3Promise = null;
  cache.list.clear();
  cache.listPromise.clear();
  cache.bodies.clear();
  cache.bodyPromise.clear();
}

async function readAssetJson(env, request, pathname) {
  if (!env?.ASSETS?.fetch) {
    const error = new Error("ASSETS binding is required");
    error.code = "assets_unavailable";
    throw error;
  }
  const origin = request?.url ? new URL(request.url).origin : "https://climekr.com";
  const response = await env.ASSETS.fetch(new Request(new URL(pathname, origin)));
  if (!response.ok) {
    const error = new Error(`Missing review asset ${pathname}`);
    error.code = "asset_missing";
    throw error;
  }
  return response.json();
}

function indexItems(data) {
  const bySlot = new Map();
  for (const item of data.items || []) bySlot.set(item.slot, item);
  return { ...data, bySlot };
}

export async function loadReviewMeta(env, request) {
  if (cache.meta) return cache.meta;
  if (!cache.metaPromise) {
    cache.metaPromise = readAssetJson(env, request, REVIEW_META_PATH).then(data => {
      cache.meta = data;
      return data;
    }, error => {
      cache.metaPromise = null;
      throw error;
    });
  }
  return cache.metaPromise;
}

async function loadListChunk(env, request, chunk) {
  if (!Number.isInteger(chunk) || chunk < 0 || chunk >= REVIEW_CHUNK_COUNT) {
    const error = new Error("review chunk out of range");
    error.code = "asset_missing";
    throw error;
  }
  const cached = cache.list.get(chunk);
  if (cached) return cached;
  let pending = cache.listPromise.get(chunk);
  if (!pending) {
    pending = readAssetJson(env, request, listChunkPath(chunk)).then(data => {
      const indexed = indexItems(data);
      cache.list.set(chunk, indexed);
      cache.listPromise.delete(chunk);
      return indexed;
    }, error => {
      cache.listPromise.delete(chunk);
      throw error;
    });
    cache.listPromise.set(chunk, pending);
  }
  return pending;
}

async function loadBodyChunk(env, request, chunk) {
  if (!Number.isInteger(chunk) || chunk < 0 || chunk >= REVIEW_CHUNK_COUNT) {
    const error = new Error("review chunk out of range");
    error.code = "asset_missing";
    throw error;
  }
  const cached = cache.bodies.get(chunk);
  if (cached) return cached;
  let pending = cache.bodyPromise.get(chunk);
  if (!pending) {
    pending = readAssetJson(env, request, bodyChunkPath(chunk)).then(data => {
      const indexed = indexItems(data);
      cache.bodies.set(chunk, indexed);
      cache.bodyPromise.delete(chunk);
      return indexed;
    }, error => {
      cache.bodyPromise.delete(chunk);
      throw error;
    });
    cache.bodyPromise.set(chunk, pending);
  }
  return pending;
}

async function loadRating3(env, request) {
  if (cache.rating3) return cache.rating3;
  if (!cache.rating3Promise) {
    cache.rating3Promise = readAssetJson(env, request, REVIEW_RATING3_PATH).then(data => {
      cache.rating3 = data;
      return data;
    }, error => {
      cache.rating3Promise = null;
      throw error;
    });
  }
  return cache.rating3Promise;
}

async function loadSlots(env, request, slots) {
  const grouped = new Map();
  for (const slot of slots) {
    const chunk = chunkIndexForSlot(slot);
    if (!grouped.has(chunk)) grouped.set(chunk, []);
    grouped.get(chunk).push(slot);
  }
  const records = [];
  for (const [chunk, wanted] of grouped) {
    const data = await loadListChunk(env, request, chunk);
    for (const slot of wanted) {
      const record = data.bySlot.get(slot);
      if (record) records.push(record);
    }
  }
  return records;
}

/**
 * Newest page of the static corpus.
 * Head = the 50 today-window slots, plus any row whose base Seoul date is
 * already today (the build day). Tail = every other slot from 9999 downward,
 * which matches base time order because those rows keep their base instant.
 */
export async function queryPublishedReviews(env, request, {
  limit = 20,
  rating = null,
  from = "",
  to = "",
  cursor = null,
  today = new Date()
} = {}) {
  const meta = await loadReviewMeta(env, request);
  const context = seoulTodayContext(today);
  const skip = new Set(todayWindowSlots(context.todayDate));
  const records = await loadSlots(env, request, skip);

  for (const range of meta.chunks || []) {
    if (range.minDate > context.todayKey || range.maxDate < context.todayKey) continue;
    const chunk = await loadListChunk(env, request, range.chunk);
    for (const record of chunk.items) {
      if (record.baseSeoulDate !== context.todayKey || skip.has(record.slot)) continue;
      skip.add(record.slot);
      records.push(record);
    }
  }

  const head = records
    .map(record => presentReview(record, today, { context }))
    .sort(comparePublishedDesc);

  if (rating != null && !Number(meta.histogram?.[String(rating)])) {
    return { items: [], nextCursor: null };
  }
  if (from && head.every(item => item.publishedAt < from) && meta.baseEnd < from) {
    return { items: [], nextCursor: null };
  }
  if (to && head.every(item => item.publishedAt > to) && meta.baseStart > to) {
    return { items: [], nextCursor: null };
  }

  const want = limit + 1;
  const collected = [];
  let passedCursor = !cursor;

  const consider = item => {
    if (collected.length >= want) return true;
    if (!passedCursor) {
      if (!isOlderThanCursor(item, cursor)) return false;
      passedCursor = true;
    }
    if (rating != null && item.rating !== rating) return false;
    if (from && item.publishedAt < from) return false;
    if (to && item.publishedAt > to) return false;
    collected.push(item);
    return collected.length >= want;
  };

  for (const item of head) {
    if (consider(item)) break;
  }

  if (collected.length < want) {
    if (rating === 3) {
      const rating3 = await loadRating3(env, request);
      for (const record of rating3.items || []) {
        if (skip.has(record.slot)) continue;
        if (consider(presentReview(record, today, { context }))) break;
      }
    } else {
      let slot = REVIEW_SLOT_COUNT - 1;
      const allHeadNewer = Boolean(cursor) && head.every(item => !isOlderThanCursor(item, cursor));
      if (allHeadNewer) {
        const cursorSlot = slotFromReviewId(cursor.id);
        if (cursorSlot != null && !skip.has(cursorSlot)) slot = cursorSlot;
      }
      while (slot >= 0 && collected.length < want) {
        const chunkIndex = chunkIndexForSlot(slot);
        const chunk = await loadListChunk(env, request, chunkIndex);
        const low = chunkIndex * REVIEW_CHUNK_SIZE;
        for (let cursorSlot = slot; cursorSlot >= low; cursorSlot -= 1) {
          if (skip.has(cursorSlot)) continue;
          const record = chunk.bySlot.get(cursorSlot);
          if (!record) continue;
          if (consider(presentReview(record, today, { context }))) {
            slot = -1;
            break;
          }
        }
        if (slot >= 0) slot = low - 1;
      }
    }
  }

  const hasMore = collected.length > limit;
  const items = hasMore ? collected.slice(0, limit) : collected;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.publishedAt, last.id) : null
  };
}

export async function getReviewStats(env, request) {
  const meta = await loadReviewMeta(env, request);
  return {
    total: meta.count,
    avgRating: meta.avgRating,
    histogram: meta.histogram,
    updatedAt: meta.builtAt
  };
}

export async function getPublishedReview(env, request, id, today = new Date()) {
  const slot = slotFromReviewId(id);
  if (slot == null) return null;
  const chunk = chunkIndexForSlot(slot);
  const [list, bodies] = await Promise.all([
    loadListChunk(env, request, chunk),
    loadBodyChunk(env, request, chunk)
  ]);
  const meta = list.bySlot.get(slot);
  const stored = bodies.bySlot.get(slot);
  if (!meta || meta.id !== id || !stored || typeof stored.body !== "string") return null;
  return presentReview({ ...meta, body: stored.body }, today, { includeBody: true });
}
