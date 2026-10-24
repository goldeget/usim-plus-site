import { isAdminRequest, readBoundedRequestBody } from "../_lib/applications.js";

const DEFAULT_CONTENT = {
  schemaVersion: 2,
  headline: "유심 개통하면\n최대 51만원",
  intro: "개통 전 참여 조건과 통신사 요금·약정을 먼저 확인하세요. 참여를 원하면 개통 후 현황 사진으로 신청하세요.",
  checklist: [
    { title: "1. 개통 전 조건 확인", body: "개통 전에 지급 조건과 통신사 공식 안내의 요금, 약정 기간, 해지 비용을 먼저 확인하세요." },
    { title: "2. 개통 후 사진 신청", body: "조건에 맞으면 유심을 개통한 뒤, 개통 현황이 보이는 화면을 사진으로 보내 신청합니다." },
    { title: "3. 유지 조건 확인 후 지급", body: "유지 기간과 신청 조건을 확인한 뒤 지급 대상이 결정됩니다." }
  ],
  faqs: [
    { question: "사진을 첨부하면 누가 확인하나요?", answer: "로그인한 운영자가 사진을 확인합니다. 사진은 검토 결정 후 30일, 미검토 신청은 접수 후 30일 동안 비공개로 보관합니다." },
    { question: "사진에는 어떤 내용을 보여야 하나요?", answer: "현재 개통 현황과 심사에 필요한 항목이 식별되도록 첨부해 주세요. 주민등록번호 전체, 인증번호, 비밀번호 등 심사와 무관한 민감정보는 가려 주세요. 실제 제출 범위는 운영자의 개인정보 처리 안내를 확인하세요." },
    { question: "지급 금액과 신청 가능 건수는 어떻게 되나요?", answer: "각 조건을 충족하고 유지 기간이 확인되면 개통 1건당 3일 5만원, 15일 추가 5만원, 30일 추가 7만원의 지급 대상이 됩니다. 한 사람 최대 3건이며 모든 조건이 확인되면 최대 51만원입니다. 3일 유지가 확인되지 않으면 첫 5만원은 지급 대상에서 제외됩니다. 실제 지급 기준과 시점은 신청 전에 문의해 확인하세요." },
    { question: "가입 전에 무엇을 확인해야 하나요?", answer: "통신사 공식 안내에서 월 요금, 약정 기간, 해지 절차와 비용을 확인하고, 이 사이트의 지급 조건도 먼저 살펴보세요. 개통 현황 사진 제출은 개통을 마친 뒤 진행합니다. 사진 검토는 통신사 개통 승인이나 지급 확정이 아닙니다." },
    { question: "왜 참여자를 모집하나요?", answer: "통신사 개통 실적 향상을 위해 참여자를 모집합니다." },
    { question: "사진 검토를 통과하면 개통이나 지급이 확정되나요?", answer: "아닙니다. 사진은 제출한 신청 내용과 참여 조건을 운영자가 확인하는 자료입니다. 사진 확인은 통신사의 개통 승인이나 지급 확정을 뜻하지 않습니다." },
    { question: "클라임유심 후기나 climekr 유심 후기를 살펴볼 때 무엇을 확인해야 하나요?", answer: "후기를 볼 때는 작성 시점, 가입 통신사·요금제·약정 조건, 실제 확인 가능한 이용 경험인지 살펴보세요. 신청 전에는 현재 안내된 지급 조건, 통신사 요금·약정·해지 비용, 개인정보 사진 보관 기간도 함께 확인해 주세요. 운영자의 사진 검토는 통신사 개통 승인이나 지급 확정을 뜻하지 않습니다." }
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
