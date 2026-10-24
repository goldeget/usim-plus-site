import { jsonResponse } from "../../_lib/applications.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) return jsonResponse({ error: "자동 접수 방지 설정이 완료되지 않았습니다." }, 503);
  return jsonResponse({ siteKey: String(env.TURNSTILE_SITE_KEY) });
}
