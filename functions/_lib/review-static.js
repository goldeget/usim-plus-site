/**
 * Public review reads. Pages Functions load generated JSON from the site
 * assets. D1 is not consulted, so a partial or empty reviews table does not
 * change /reviews/, the home strip, or /api/reviews*.
 *
 * The query itself lives in public/reviews/review-corpus.js so a static host
 * can run the same reader when /api/reviews is not available.
 */
import { createReviewCorpus } from "../../public/reviews/review-corpus.js";

const corpus = createReviewCorpus();

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

function reader(env, request) {
  return pathname => readAssetJson(env, request, pathname);
}

export function resetReviewStaticCache() {
  corpus.reset();
}

export function loadReviewMeta(env, request) {
  return corpus.loadReviewMeta(reader(env, request));
}

export function queryPublishedReviews(env, request, options) {
  return corpus.queryPublishedReviews(reader(env, request), options);
}

export function getReviewStats(env, request) {
  return corpus.getReviewStats(reader(env, request));
}

export function getPublishedReview(env, request, id, today) {
  return corpus.getPublishedReview(reader(env, request), id, today);
}
