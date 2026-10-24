const DEFAULT_CONTENT = {
  headline: "유심 가입 전, 조건부터 확인하세요.",
  intro: "요금제와 개통 조건은 통신사·상품별로 다를 수 있습니다. 가입을 진행하기 전에 해당 통신사의 공식 홈페이지나 고객센터에서 최신 안내와 계약 조건을 확인하세요.",
  checklist: [
    { title: "월 요금과 제공 내용", body: "기본료, 데이터·통화 제공량, 부가서비스와 할인 종료 시점까지 확인하세요." },
    { title: "개통 조건과 기기 호환", body: "본인 확인에 필요한 절차, 이용 가능한 단말기와 유심 종류를 공식 채널에서 확인하세요." },
    { title: "약정·해지 조건", body: "약정 기간, 해지 신청 방법, 위약금이나 반환 비용이 발생하는 조건을 계약 전에 살펴보세요." }
  ],
  faqs: [
    { question: "통신사별 개통 조건은 어디서 확인하나요?", answer: "가입하려는 통신사의 공식 홈페이지, 공식 앱 또는 고객센터에서 현재 조건을 확인하세요. 판매처 안내와 계약서 내용도 함께 비교하는 것이 좋습니다." },
    { question: "이 페이지에서 유심 신청이나 개통 가능 여부 확인을 할 수 있나요?", answer: "아니요. 이 페이지는 일반 정보 안내용이며 가입 신청, 개통 판정, 사진·신분증 접수를 하지 않습니다." },
    { question: "가입 후 해지할 때 비용이 발생할 수 있나요?", answer: "요금제와 계약 조건에 따라 달라질 수 있습니다. 약정, 할인 반환, 단말기 할부 등 관련 항목을 해당 통신사의 공식 약관과 계약서에서 확인하세요." },
    { question: "인증번호나 개통 화면을 전달해도 되나요?", answer: "인증번호, 비밀번호, 신분증 사진, 계정 화면은 타인에게 전달하지 마세요. 요청을 받으면 공식 고객센터를 통해 먼저 확인하세요." }
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
  if (!Array.isArray(value.checklist) || value.checklist.length < 1 || value.checklist.length > 6) return "확인 항목은 1~6개로 입력하세요.";
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
    if (!env.CONTENT_DB) return json(DEFAULT_CONTENT);
    const row = await env.CONTENT_DB.prepare("SELECT content, updated_at FROM site_content WHERE id = ?").bind("home").first();
    if (!row) return json(DEFAULT_CONTENT);
    try { return json({ ...JSON.parse(row.content), updatedAt: row.updated_at }); }
    catch { return json(DEFAULT_CONTENT); }
  }

  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== "manage.climekr.com") return json({ error: "관리용 도메인에서만 저장할 수 있습니다." }, 403);
  if (!request.headers.get("cf-access-authenticated-user-email")) return json({ error: "Cloudflare Access 인증이 필요합니다." }, 401);
  if (request.headers.get("origin") !== "https://manage.climekr.com") return json({ error: "요청 출처를 확인할 수 없습니다." }, 403);
  if (!env.CONTENT_DB) return json({ error: "콘텐츠 저장소가 아직 연결되지 않았습니다." }, 503);

  let content;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: "요청 크기가 너무 큽니다." }, 413);
    content = JSON.parse(raw);
  } catch { return json({ error: "JSON 형식의 요청이 필요합니다." }, 400); }

  const issue = validateContent(content);
  if (issue) return json({ error: issue }, 400);
  const safe = {
    headline: content.headline.trim(), intro: content.intro.trim(),
    checklist: content.checklist.map(x => ({ title: x.title.trim(), body: x.body.trim() })),
    faqs: content.faqs.map(x => ({ question: x.question.trim(), answer: x.answer.trim() }))
  };
  const updatedAt = new Date().toISOString();
  await env.CONTENT_DB.prepare("INSERT INTO site_content (id, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at")
    .bind("home", JSON.stringify(safe), updatedAt).run();
  return json({ content: safe, updatedAt });
}
