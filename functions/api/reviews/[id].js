import { publicJson } from "../../_lib/reviews.js";
import { getPublishedReview } from "../../_lib/review-static.js";

export async function onRequest({ request, env, params }) {
  if (request.method !== "GET") return publicJson({ error: "허용되지 않은 요청입니다." }, 405, 0);
  const id = String(params?.id || "").trim();
  if (!id) return publicJson({ error: "후기를 찾을 수 없습니다." }, 404, 0);
  try {
    const item = await getPublishedReview(env, request, id);
    if (!item) return publicJson({ error: "후기를 찾을 수 없습니다." }, 404, 0);
    return publicJson(item, 200, 300);
  } catch {
    return publicJson({ error: "후기를 불러오지 못했습니다." }, 503, 0);
  }
}
