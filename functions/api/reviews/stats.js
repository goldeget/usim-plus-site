import { publicJson } from "../../_lib/reviews.js";
import { getReviewStats } from "../../_lib/review-static.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return publicJson({ error: "허용되지 않은 요청입니다." }, 405, 0);
  try {
    const stats = await getReviewStats(env, request);
    return publicJson(stats, 200, 300);
  } catch {
    return publicJson({ error: "후기 집계를 불러오지 못했습니다." }, 503, 0);
  }
}
