import { jsonResponse } from "../_lib/applications.js";

// Cached copies of the retired form must not create new orphaned photo receipts.
export async function onRequest({ request }) {
  if (request.method !== "POST") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  return jsonResponse({
    error: "홈페이지 사진 접수는 종료되었습니다. LINE·텔레그램·채널톡 상담창에서 사진을 보내 주세요.",
    consultationUrl: "https://climekr.com/#contact"
  }, 410);
}
