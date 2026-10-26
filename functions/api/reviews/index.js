import { decodeCursor, publicJson } from "../../_lib/reviews.js";
import { queryPublishedReviews } from "../../_lib/review-static.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return publicJson({ error: "허용되지 않은 요청입니다." }, 405, 0);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
  const ratingParam = url.searchParams.get("rating");
  const rating = /^[1-5]$/.test(ratingParam || "") ? Number(ratingParam) : null;
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  try {
    const page = await queryPublishedReviews(env, request, { limit, rating, from, to, cursor });
    return publicJson(page, 200, 60);
  } catch {
    return publicJson({ error: "후기 목록을 불러오지 못했습니다." }, 503, 0);
  }
}
