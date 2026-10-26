import { isAdminRequest, jsonResponse } from "../../../_lib/applications.js";
import { rebuildReviewStats } from "../../../_lib/reviews.js";

export async function onRequest({ request, env }) {
  if (!(await isAdminRequest(request, env, { requireOrigin: true }))) {
    return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  }
  if (request.method !== "POST") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.CONTENT_DB) return jsonResponse({ error: "후기 저장소가 연결되지 않았습니다." }, 503);

  try {
    const stats = await rebuildReviewStats(env.CONTENT_DB);
    return jsonResponse({ ok: true, stats });
  } catch {
    return jsonResponse({ error: "집계를 갱신하지 못했습니다." }, 503);
  }
}
