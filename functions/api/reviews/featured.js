import { publicJson } from "../../_lib/reviews.js";
import { queryPublishedReviews } from "../../_lib/review-static.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return publicJson({ error: "허용되지 않은 요청입니다." }, 405, 0);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 8, 1), 20);
  try {
    const page = await queryPublishedReviews(env, request, { limit });
    return publicJson({ items: page.items }, 200, 60);
  } catch {
    return publicJson({ error: "후기를 불러오지 못했습니다." }, 503, 0);
  }
}
