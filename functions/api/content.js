import { isAdminRequest, readBoundedRequestBody } from "../_lib/applications.js";

const DEFAULT_CONTENT = {
  schemaVersion: 2,
  headline: "개통 현황 확인 후\n사진으로 사전 검토 신청",
  intro: "KAIT에서 조회한 개통 현황을 사진으로 첨부해 사전 검토를 요청합니다.",
  checklist: [
    { title: "1. 개통 현황 확인", body: "KAIT(한국정보통신진흥협회) 공식 사이트에서 본인인증 후 확인합니다." },
    { title: "2. 사진 사전 검토 신청", body: "현재 개통 현황이 확인되는 화면을 사진으로 첨부합니다." },
    { title: "3. 접수번호로 결과 확인", body: "신청이 접수되면 받은 접수번호와 조회 코드로 상태를 확인합니다." }
  ],
  faqs: [
    { question: "사진을 첨부하면 누가 확인하나요?", answer: "로그인한 운영자가 사진을 확인합니다. 사진은 검토 결정 후 30일, 미검토 신청은 접수 후 30일 동안 비공개로 보관합니다." },
    { question: "사진에는 어떤 내용을 보여야 하나요?", answer: "현재 개통 현황과 심사에 필요한 항목이 식별되도록 첨부해 주세요. 주민등록번호 전체, 인증번호, 비밀번호 등 심사와 무관한 민감정보는 가려 주세요. 실제 제출 범위는 운영자의 개인정보 처리 안내를 확인하세요." },
    { question: "지급 금액과 신청 가능 건수는 어떻게 되나요?", answer: "각 조건을 충족하고 유지 기간이 확인되면 개통 1건당 3일 5만원, 15일 추가 5만원, 30일 추가 7만원의 지급 대상이 됩니다. 한 사람 최대 3건이며 모든 조건이 확인되면 최대 51만원입니다. 3일 유지가 확인되지 않으면 첫 5만원은 지급 대상에서 제외됩니다. 실제 지급 기준과 시점은 신청 전에 문의해 확인하세요." },
    { question: "가입 전에 무엇을 확인해야 하나요?", answer: "통신사 공식 안내에서 월 요금, 약정 기간, 해지 절차와 비용을 확인하세요. 사진 사전 검토는 통신사 개통 승인이나 지급 확정이 아닙니다." },
    { question: "왜 참여자를 모집하나요?", answer: "통신사 개통 실적 향상을 위해 참여자를 모집합니다." },
    { question: "사진 검토를 통과하면 개통이나 지급이 확정되나요?", answer: "아닙니다. 사진 검토는 제출한 정보의 사전 확인입니다. 실제 개통 가능 여부는 통신사가 결정하며, 지급 여부와 시점은 신청 조건을 확인해 주세요." },
    { question: "클라임유심·climekr유심 후기와 참여 정보를 확인할 때 무엇을 살펴봐야 하나요?", answer: "신청 전에는 사진 사전 검토 범위, 지급 조건, 통신사 요금·약정·해지 비용, 개인정보 사진 보관 기간을 함께 확인하세요. 검토 결과는 통신사 개통 승인이나 지급 확정을 뜻하지 않습니다." }
  ]
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
});

function validateContent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "잘못된 요청입니다.";
  if (typeof value.headline !== "string" || value.headline.trim().length < 1 || value.headline.length > 100) return "제목은 1~100자로 입력하세요.";
  if (typeof value.intro !== "string" || value.intro.trim().length < 1 || value.intro.length > 500) return "안내 문구는 1~500자로 입력하세요.";
  if (!Array.isArray(value.checklist) || value.checklist.length !== 3) return "참여 단계는 세 개로 고정되어 있습니다.";
  if (!Array.isArray(value.faqs) || value.faqs.length < 1 || value.faqs.length > 10) return "FAQ는 1~10개로 입력하세요.";
  for (const item of value.checklist) {
    if (!item || typeof item.title !== "string" || item.title.trim().length < 1 || item.title.length > 80 || typeof item.body !== "string" || item.body.trim().length < 1 || item.body.length > 300) return "확인 항목의 제목과 설명 길이를 확인하세요.";
  }
  for (const item of value.faqs) {
    if (!item || typeof item.question !== "string" || item.question.trim().length < 1 || item.question.length > 160 || typeof item.answer !== "string" || item.answer.trim().length < 1 || item.answer.length > 400) return "FAQ 질문과 답변 길이를 확인하세요.";
  }
  return null;
}

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    if (!env.CONTENT_DB) return json({ ...DEFAULT_CONTENT, cmsReady: false });
    let row;
    try { row = await env.CONTENT_DB.prepare("SELECT content, updated_at FROM site_content WHERE id = ?").bind("home").first(); }
    catch { return json({ ...DEFAULT_CONTENT, cmsReady: false, error: "홈페이지 안내 저장소를 불러오지 못했습니다." }, 503); }
    if (!row) return json({ ...DEFAULT_CONTENT, cmsReady: true });
    try {
      const stored = JSON.parse(row.content);
      if (stored.schemaVersion !== 2 || validateContent(stored)) return json({ ...DEFAULT_CONTENT, updatedAt: row.updated_at, cmsReady: true, legacyContent: true });
      return json({ ...DEFAULT_CONTENT, ...stored, updatedAt: row.updated_at, cmsReady: true });
    } catch { return json({ ...DEFAULT_CONTENT, updatedAt: row.updated_at, cmsReady: true, legacyContent: true }); }
  }

  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  if (!(await isAdminRequest(request, env, { requireOrigin: true }))) return json({ error: "관리자 로그인 또는 요청 출처를 확인할 수 없습니다." }, 401);
  if (!env.CONTENT_DB) return json({ error: "콘텐츠 저장소가 아직 연결되지 않았습니다." }, 503);

  let content;
  try {
    const boundedBody = await readBoundedRequestBody(request, 36000);
    if (boundedBody.tooLarge) return json({ error: "요청 크기가 너무 큽니다." }, 413);
    const raw = new TextDecoder().decode(boundedBody.bytes);
    if (raw.length > 12000) return json({ error: "요청 크기가 너무 큽니다." }, 413);
    content = JSON.parse(raw);
  } catch { return json({ error: "JSON 형식의 요청이 필요합니다." }, 400); }

  const issue = validateContent(content);
  if (issue) return json({ error: issue }, 400);
  const safe = {
    schemaVersion: 2,
    headline: content.headline.trim(), intro: content.intro.trim(),
    checklist: content.checklist.map(x => ({ title: x.title.trim(), body: x.body.trim() })),
    faqs: content.faqs.map(x => ({ question: x.question.trim(), answer: x.answer.trim() }))
  };
  const updatedAt = new Date().toISOString();
  try {
    const previous = await env.CONTENT_DB.prepare("SELECT content, updated_at FROM site_content WHERE id = ?").bind("home").first();
    if (previous) {
      let current = null;
      try { current = JSON.parse(previous.content); } catch {}
      if (!current || current.schemaVersion !== 2 || validateContent(current)) {
        await env.CONTENT_DB.prepare("INSERT INTO site_content (id, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING")
          .bind("home_legacy", previous.content, previous.updated_at || updatedAt).run();
      }
    }
    await env.CONTENT_DB.prepare("INSERT INTO site_content (id, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at")
      .bind("home", JSON.stringify(safe), updatedAt).run();
  } catch {
    return json({ error: "홈페이지 안내를 저장하지 못했습니다. 잠시 후 다시 확인해 주세요." }, 503);
  }
  return json({ content: safe, updatedAt });
}
