import { isAdminRequest, jsonResponse, PHOTO_RETENTION_MS } from "../../_lib/applications.js";
import { DUPLICATE_REVIEW_NOTICE, loadDuplicateGroups } from "../../_lib/admin-review.js";

const DECISION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export async function onRequest({ request, env }) {
  if (!(await isAdminRequest(request, env))) return jsonResponse({ error: "관리자 로그인이 필요합니다." }, 401);
  if (request.method !== "GET") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.CONTENT_DB) return jsonResponse({ error: "신청 저장소가 연결되지 않았습니다." }, 503);

  const pendingCutoff = new Date(Date.now() - PHOTO_RETENTION_MS).toISOString();
  const decisionCutoff = new Date(Date.now() - DECISION_LOOKBACK_MS).toISOString();
  try {
    const [summary, duplicateData] = await Promise.all([
      env.CONTENT_DB.prepare(
        "SELECT (SELECT COUNT(*) FROM application_submissions WHERE status = 'pending' AND created_at > ?) AS pending_count, (SELECT COUNT(*) FROM application_submissions WHERE status = 'approved' AND reviewed_at > ?) AS approved_count, (SELECT COUNT(*) FROM application_submissions WHERE status = 'rejected' AND reviewed_at > ?) AS rejected_count"
      ).bind(pendingCutoff, decisionCutoff, decisionCutoff).first(),
      loadDuplicateGroups(env)
    ]);
    return jsonResponse({
      asOf: new Date().toISOString(),
      stats: {
        pending: Number(summary?.pending_count || 0),
        approvedLast7Days: Number(summary?.approved_count || 0),
        rejectedLast7Days: Number(summary?.rejected_count || 0),
        duplicateGroups: duplicateData.groups.length
      },
      duplicateNotice: DUPLICATE_REVIEW_NOTICE,
      duplicateScanTruncated: duplicateData.truncated
    });
  } catch {
    return jsonResponse({ error: "운영 현황을 불러오지 못했습니다." }, 503);
  }
}
