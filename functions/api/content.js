import { isAdminRequest, readBoundedRequestBody } from "../_lib/applications.js";

export const DEFAULT_CONTENT = {
  "schemaVersion": 3,
  "headline": "유심 개통 가능하면\n최대 51만원",
  "intro": "먼저 개통 가능 여부를 조회하세요.\n조회 사진은 상담창으로 보내 주세요.",
  "checklist": [
    {
      "title": "1. 개통 가능 여부 확인",
      "body": "조회 사이트에서 본인 명의 개통 가능 여부를 확인하세요."
    },
    {
      "title": "2. 사진 보내고 상담하기",
      "body": "조회 결과를 캡처해 LINE·텔레그램·채널톡 상담창으로 보내 주세요."
    },
    {
      "title": "3. 조건 확인 후 안내",
      "body": "운영자가 같은 대화에서 다음 절차를 안내합니다. 유지 조건 확인 후 지급 대상이 결정됩니다."
    }
  ],
  "supportLinks": {
    "telegram": "",
    "line": "",
    "channeltalk": ""
  },
  "faqs": [
    {
      "question": "어떻게 신청하나요?",
      "answer": "개통 가능 여부를 조회하고 결과 화면을 캡처하세요.\nLINE·텔레그램·채널톡 중 연결된 상담 채널에서 운영자에게 사진을 보내 주세요."
    },
    {
      "question": "어떤 사진을 보내면 되나요?",
      "answer": "개통 가능 여부를 조회한 결과 화면을 보내 주세요.\n주민등록번호·인증번호·비밀번호는 가려 주세요.\n사진을 보내기 전 상담창에서 개인정보 이용·보관 안내를 확인해 주세요."
    },
    {
      "question": "지급 금액과 신청 가능 건수는 어떻게 되나요?",
      "answer": "조건과 유지 기간이 확인되면 개통 1건당 3일 5만원, 15일 추가 5만원, 30일 추가 7만원이 지급 대상입니다.\n한 사람 최대 3건이며, 모든 조건 충족 시 최대 51만원입니다.\n3일 유지가 확인되지 않으면 해당 건의 첫 5만원은 지급 대상에서 제외됩니다.\n지급 기준과 시점은 상담창에서 확인해 주세요."
    },
    {
      "question": "개통 가능 여부는 어떻게 확인하나요?",
      "answer": "홈페이지의 ‘개통 가능 여부 확인’ 버튼으로 조회 사이트를 열어 주세요.\n조회 결과를 캡처해 상담창으로 보내 주세요. 도움이 필요하면 운영자에게 문의하세요."
    },
    {
      "question": "왜 참여자를 모집하나요?",
      "answer": "유심 개통 실적 향상을 위한 참여 안내입니다."
    },
    {
      "question": "상담하거나 사진을 보내면 바로 지급되나요?",
      "answer": "아닙니다.\n신청 내용과 유지 조건 확인 후 지급 대상이 결정됩니다.\n진행 상황과 결과는 사진을 보낸 상담창에서 안내받으세요."
    },
    {
      "question": "클라임유심 후기나 climekr 유심 후기를 살펴볼 때 무엇을 확인해야 하나요?",
      "answer": "후기를 볼 때 작성 시점과 실제 이용 경험인지 확인해 주세요.\n신청 전 현재 지급 금액과 유지 조건을 확인하세요.\n사진 확인만으로 지급이 확정되지는 않습니다."
    }
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
  if (value.supportLinks !== undefined) {
    if (!value.supportLinks || typeof value.supportLinks !== "object" || Array.isArray(value.supportLinks)) return "상담 링크를 확인하세요.";
    for (const key of ["telegram", "line", "channeltalk"]) {
      const link = value.supportLinks[key];
      if (typeof link !== "string" || link.length > 500) return "상담 링크를 확인하세요.";
      if (!link.trim()) continue;
      let url;
      try { url = new URL(link.trim()); } catch { return "상담 링크 주소를 확인하세요."; }
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return "상담 링크는 HTTPS 주소를 입력하세요.";
    }
  }
  return null;
}

function safeSupportLinks(links) {
  return Object.fromEntries(["telegram", "line", "channeltalk"].map(key => {
    const link = links?.[key];
    if (typeof link === "string" && link.length <= 500) {
      try { const url = new URL(link.trim()); if (url.protocol === "https:" && url.hostname && !url.username && !url.password) return [key, link.trim()]; } catch {}
    }
    return [key, ""];
  }));
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
      if (stored.schemaVersion !== 3 || validateContent(stored)) {
        const supportLinks = safeSupportLinks(stored.supportLinks);
        return json({ ...DEFAULT_CONTENT, supportLinks, updatedAt: row.updated_at, cmsReady: true, legacyContent: true });
      }
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

  if (!content || typeof content !== "object" || Array.isArray(content)) return json({ error: "잘못된 요청입니다." }, 400);
  if (content.schemaVersion !== 3) return json({ error: "상담 접수 방식으로 변경되었습니다. 화면을 새로고침한 뒤 다시 저장해 주세요." }, 409);
  const issue = validateContent(content);
  if (issue) return json({ error: issue }, 400);
  const safe = {
    schemaVersion: 3,
    headline: content.headline.trim(), intro: content.intro.trim(),
    checklist: content.checklist.map(x => ({ title: x.title.trim(), body: x.body.trim() })),
    faqs: content.faqs.map(x => ({ question: x.question.trim(), answer: x.answer.trim() })),
    supportLinks: Object.fromEntries(["telegram", "line", "channeltalk"].map(key => [key, (content.supportLinks?.[key] || "").trim()]))
  };
  const updatedAt = new Date().toISOString();
  try {
    const previous = await env.CONTENT_DB.prepare("SELECT content, updated_at FROM site_content WHERE id = ?").bind("home").first();
    if (previous) {
      let current = null;
      try { current = JSON.parse(previous.content); } catch {}
      if (content.supportLinks === undefined && current?.supportLinks) {
        safe.supportLinks = safeSupportLinks(current.supportLinks);
      }
      if (!current || current.schemaVersion !== 3 || validateContent(current)) {
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
