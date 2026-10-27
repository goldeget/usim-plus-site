/**
 * Browser reader for /reviews/data when /api/reviews is not served
 * (plain static hosts). Pages Functions keep using the API.
 */
import { createReviewCorpus, decodeCursor } from "./review-corpus.js";

const corpus = createReviewCorpus();

async function readStaticJson(pathname) {
  const response = await fetch(pathname, { headers: { Accept: "application/json" } });
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (!response.ok || !type.includes("json")) {
    const error = new Error(`Missing review asset ${pathname}`);
    error.code = "asset_missing";
    throw error;
  }
  return response.json();
}

export async function queryStaticReviews({
  limit = 20,
  rating = null,
  from = "",
  to = "",
  cursor = null,
  today = new Date()
} = {}) {
  const decoded = typeof cursor === "string" ? decodeCursor(cursor) : cursor;
  return corpus.queryPublishedReviews(readStaticJson, {
    limit,
    rating,
    from,
    to,
    cursor: decoded,
    today
  });
}

export function staticReviewStats() {
  return corpus.getReviewStats(readStaticJson);
}

export function staticReviewDetail(id, today = new Date()) {
  return corpus.getPublishedReview(readStaticJson, id, today);
}

export async function loadStaticHome(limit = 4) {
  const [stats, page] = await Promise.all([
    corpus.getReviewStats(readStaticJson),
    corpus.queryPublishedReviews(readStaticJson, { limit })
  ]);
  return { stats, items: page.items || [] };
}
