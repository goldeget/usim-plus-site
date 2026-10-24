import { isAdminRequest, jsonResponse } from "../../../_lib/applications.js";
import { DUPLICATE_REVIEW_NOTICE, loadApplicationDuplicateSignals, loadDuplicateGroupPage, loadDuplicateGroups } from "../../../_lib/admin-review.js";

export async function onRequest({ request, env }) {
  if (!(await isAdminRequest(request, env))) return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  if (request.method !== "GET") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.CONTENT_DB) return jsonResponse({ error: "신청 저장소가 연결되지 않았습니다." }, 503);
  try {
    const params = new URL(request.url).searchParams;
    if (params.has("applications")) {
      const ids = (params.get("applications") || "").split(",");
      const result = await loadApplicationDuplicateSignals(env, ids);
      if (result.error) return jsonResponse({ error: result.error }, result.status);
      return jsonResponse(result);
    }
    if (["type", "reference", "cursor"].some(key => params.has(key))) {
      const type = params.get("type");
      const referenceId = params.get("reference");
      const cursor = params.get("cursor");
      if (!type || !referenceId) return jsonResponse({ error: "중복 접수 묶음 위치를 확인해 주세요." }, 400);
      const page = await loadDuplicateGroupPage(env, { type, referenceId, cursor });
      if (page.error) return jsonResponse({ error: page.error }, page.status);
      return jsonResponse(page);
    }
    const result = await loadDuplicateGroups(env);
    return jsonResponse({ ...result, disclaimer: DUPLICATE_REVIEW_NOTICE });
  } catch {
    return jsonResponse({ error: "중복 의심 접수 목록을 불러오지 못했습니다." }, 503);
  }
}
