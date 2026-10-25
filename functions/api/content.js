import { isAdminRequest, readBoundedRequestBody } from "../_lib/applications.js";

export const DEFAULT_CONTENT = {
  "schemaVersion": 4,
  "headline": "유심 개통 가능하면\n최대 {{MAX_TOTAL}}",
  "intro": "먼저 개통 가능 여부를 조회하세요.\n조회 사진은 상담창으로 보내 주세요.",
  "checklist": [
    {
      "title": "1. 개통 가능 여부 확인",
      "body": "조회 사이트에서 본인 명의 개통 가능 여부를 확인하세요."
    },
    {
      "title": "2. 사진 보내고 상담하기",
      "body": "조회 결과를 캡처해 텔레그램·채널톡 상담창으로 보내 주세요."
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
  "lookup": {
    "url": "https://www.credit.or.kr/credit/search",
    "label": "개통 가능 여부 확인"
  },
  "payout": {
    "milestones": [
      { "days": 3, "amount": 50000 },
      { "days": 15, "amount": 50000 },
      { "days": 30, "amount": 70000 }
    ],
    "maxCases": 3
  },
  "operator": {
    "company": "에스씨아이평가정보(주)",
    "representative": "임동훈",
    "email": "help@climekr.com"
  },
  "seo": {
    "title": "클라임유심 | 유심 개통 가능하면 최대 {{MAX_TOTAL}}",
    "description": "클라임유심(climekr 유심) 개통 가능 여부와 지급 조건을 상담하고, 조회 내역 캡처는 상담창으로 보내 주세요. 유지 기간별 지급 금액과 신청 방법을 확인할 수 있습니다.",
    "socialTitle": "클라임유심 | 유심 개통 가능 여부와 지급 안내",
    "socialDescription": "개통 가능 여부와 참여 조건을 확인하고, 조회 내역 캡처는 텔레그램·채널톡 상담창으로 보내 주세요."
  },
  "copy": {
    "brandSub": "유심 개통 · 간편 참여 안내",
    "headerHelp": "상담하기",
    "heroEyebrow": "유심 개통 혜택 참여",
    "heroApplyLabel": "사진 심사 신청하기",
    "heroChatNote": "이미 조회하셨다면 상담창에 사진을 보내 주세요.",
    "payoutNote": "유지 조건을 확인한 뒤 지급 대상이 결정됩니다.",
    "payoutAriaLabel": "유지 기간별 지급 금액",
    "contactKicker": "운영자와 직접 상담",
    "contactTitle": "사진 보내고 상담하기",
    "contactIntro": "편한 상담 채널을 선택해 주세요.\n조회 사진 전송부터 결과 안내까지, 같은 대화에서 이어집니다.",
    "contactLookupPrompt": "아직 조회하지 않으셨나요?",
    "contactLookupLabel": "개통 가능 여부 확인",
    "channelReady": "상담창이 새 창으로 열립니다. 사진을 보낸 상담창에서 답변을 확인해 주세요.",
    "channelMissing": "현재 연결된 상담 채널이 없습니다. {{EMAIL}}으로 문의해 주세요.",
    "channelStart": "상담 시작하기",
    "channelNotReady": "연결 준비 중",
    "channelUnavailableTitle": "상담 채널 준비 중",
    "channelUnavailableMessage": "이 채널은 아직 연결되지 않았습니다. 연결된 다른 채널이나 {{EMAIL}}으로 문의해 주세요.",
    "consultationSafety": "주민등록번호·인증번호·비밀번호는 가려 주세요.\n사진은 선택한 상담창에서 직접 보내 주세요.",
    "emailLinkLabel": "이메일 문의",
    "guideSummary": "신청 방법",
    "guideTitle": "신청 방법",
    "guideIntro": "편한 상담 채널을 선택하세요.\n사진 전송과 결과 안내는 같은 상담창에서 진행합니다.",
    "stepsTitle": "신청 순서",
    "lookupStepLabel": "조회 사이트 열기",
    "contactStepLabel": "상담 채널 선택하기",
    "faqTitle": "자주 묻는 질문",
    "statusDisclosure": "이전에 홈페이지에서 신청했어요 · 기존 접수 조회",
    "statusTitle": "기존 접수 정보 입력",
    "statusHelp": "예전에 홈페이지에 사진을 제출한 신청만 조회할 수 있습니다.\n상담창으로 보낸 사진과 진행 상황은 같은 상담창에서 확인해 주세요.",
    "statusIdLabel": "접수번호",
    "statusTokenLabel": "조회 코드",
    "statusSubmit": "상태 확인",
    "statusLoading": "검토 상태를 확인하고 있습니다…",
    "statusResultPrefix": "검토 상태",
    "statusReviewedAtLabel": "검토 시각",
    "statusTimezoneLabel": "한국 표준시",
    "statusUnknown": "확인할 수 없음",
    "statusErrorTitle": "상태를 확인하지 못했습니다",
    "statusErrorMessage": "접수번호와 조회 코드를 확인해 주세요. 문제가 계속되면 {{EMAIL}}으로 문의해 주세요.",
    "statusPending": "운영자 사진 검토 대기 중",
    "statusApproved": "사진 검토 승인",
    "statusRejected": "사진 검토 반려",
    "statusExpired": "보관 기간 만료",
    "privacySummary": "기존 홈페이지 접수의 개인정보 보관 안내",
    "privacyCollection": "제출한 개통 가능 여부 조회 내역 캡처, 자동 생성 접수번호, 접수·검토 시각과 상태, 신청 상태를 확인하기 위한 조회 코드 확인 정보, 같은 사진 또는 같은 인터넷 접속에서 신청된 기록이 있는지 확인하기 위한 비교 정보.\n인터넷 주소(IP) 원문은 저장하지 않습니다.\n이름·전화번호·신분증·인증번호·비밀번호는 입력받지 않습니다.",
    "privacyCollectionLabel": "수집 항목",
    "privacyPurpose": "조회 내역 캡처 접수, 운영자 심사, 신청 상태 확인과 처리 이력 관리, 같은 사진 또는 같은 인터넷 접속에서 접수된 기록을 운영자가 함께 살펴봅니다.\n이 정보만으로 같은 사람이라고 단정하거나 신청을 자동 처리하지 않습니다.",
    "privacyPurposeLabel": "이용 목적",
    "privacyPhotoRetentionLabel": "사진 보유 기간",
    "privacyStatusRetentionLabel": "접수 상태 정보 보유 기간",
    "privacyStorage": "사진은 일반 이용자에게 공개되지 않는 저장 공간에 보관하며 로그인한 운영자만 확인합니다. 접속 주소(IP) 원문은 저장하지 않습니다.\n같은 인터넷 접속을 이용한 다른 사람일 수 있으므로 중복 확인 정보만으로 같은 사람이라고 단정하거나 자동 처리하지 않습니다.",
    "privacyStorageLabel": "보관 방법",
    "privacyOperatorLabel": "책임자",
    "privacyConsent": "기존 홈페이지 접수의 개인정보 수집·이용에 동의하지 않을 수 있습니다. 동의하지 않으면 해당 접수 정보는 처리되지 않습니다.",
    "privacyConsentLabel": "동의 거부",
    "privacyProvider": "사이트 운영과 기존 신청 사진 보관에 Cloudflare의 클라우드 서비스를 이용합니다.",
    "privacyProviderLabel": "처리 서비스",
    "footerBrand": "클라임유심 · climekr.com",
    "footerTerms": "유지 조건 확인 후 단계별 지급 대상\n한 사람 최대 {{MAX_CASES}}건, 모두 충족 시 최대 {{MAX_TOTAL}}",
    "operatorSummary": "운영자 정보",
    "operatorCompanyLabel": "법인명",
    "operatorRepresentativeLabel": "대표자",
    "operatorEmailLabel": "문의"
  },
  "faqs": [
    {
      "question": "어떻게 신청하나요?",
      "answer": "개통 가능 여부를 조회하고 결과 화면을 캡처하세요.\n텔레그램·채널톡 중 연결된 상담 채널에서 운영자에게 사진을 보내 주세요."
    },
    {
      "question": "어떤 사진을 보내면 되나요?",
      "answer": "개통 가능 여부를 조회한 결과 화면을 보내 주세요.\n주민등록번호·인증번호·비밀번호는 가려 주세요.\n사진을 보내기 전 상담창에서 개인정보 이용·보관 안내를 확인해 주세요."
    },
    {
      "key": "payoutSchedule",
      "question": "지급 금액과 신청 가능 건수는 어떻게 되나요?",
      "answer": ""
    },
    {
      "question": "개통 가능 여부는 어떻게 확인하나요?",
      "answer": "홈페이지의 ‘{{LOOKUP_LABEL}}’ 버튼으로 조회 사이트를 열어 주세요.\n조회 결과를 캡처해 상담창으로 보내 주세요. 도움이 필요하면 운영자에게 문의하세요."
    },
    {
      "question": "왜 참여자를 모집하나요?",
      "answer": "유심 개통을 검토하는 분께 참여 조건과 지급 기준을 안내하고, 조건을 충족한 분에게 약속된 금액을 지급하기 위해 모집합니다.\n지급 대상과 금액은 조회 결과와 유지 조건을 확인한 뒤 결정됩니다."
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

const COPY_LIMITS = Object.fromEntries(Object.keys(DEFAULT_CONTENT.copy).map(key => [key, 500]));
const RETENTION_DAYS = Object.freeze({ photoAfterDecision: 30, photoIfUnreviewed: 30, statusMetadata: 60 });
const MAX_CONTENT_REQUEST_BYTES = 160_000;
const FIXED_PRIVACY_COPY_KEYS = Object.freeze([
  "privacyCollection", "privacyPurpose", "privacyStorage", "privacyConsent", "privacyProvider"
]);

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
});

function isSafeHttpsUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

export function validateV3(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "잘못된 요청입니다.";
  if (typeof value.headline !== "string" || value.headline.trim().length < 1 || value.headline.length > 100) return "제목은 1~100자로 입력하세요.";
  if (typeof value.intro !== "string" || value.intro.trim().length < 1 || value.intro.length > 500) return "안내 문구는 1~500자로 입력하세요.";
  if (!Array.isArray(value.checklist) || value.checklist.length !== 3) return "참여 단계는 세 개로 고정되어 있습니다.";
  if (!Array.isArray(value.faqs) || value.faqs.length < 1 || value.faqs.length > 10) return "FAQ는 1~10개로 입력하세요.";
  for (const item of value.checklist) {
    if (!item || typeof item.title !== "string" || item.title.trim().length < 1 || item.title.length > 80 || typeof item.body !== "string" || item.body.trim().length < 1 || item.body.length > 300) return "확인 항목의 제목과 설명 길이를 확인하세요.";
  }
  for (const item of value.faqs) {
    if (!item || typeof item.question !== "string" || item.question.trim().length < 1 || item.question.length > 160 || typeof item.answer !== "string" || item.answer.length > 400 || (item.key !== "payoutSchedule" && !item.answer.trim())) return "FAQ 질문과 답변 길이를 확인하세요.";
  }
  if (value.supportLinks !== undefined) {
    if (!value.supportLinks || typeof value.supportLinks !== "object" || Array.isArray(value.supportLinks)) return "상담 링크를 확인하세요.";
    for (const key of ["telegram", "line", "channeltalk"]) {
      const link = value.supportLinks[key];
      if (typeof link !== "string" || link.length > 500 || (link.trim() && !isSafeHttpsUrl(link.trim()))) return "상담 링크는 HTTPS 주소를 입력하세요.";
    }
  }
  return null;
}

export function validateContent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "잘못된 요청입니다.";
  const baseIssue = validateV3(value);
  if (baseIssue) return baseIssue;
  if (!value.lookup || typeof value.lookup !== "object" || Array.isArray(value.lookup) || typeof value.lookup.url !== "string" || value.lookup.url.length > 500 || !isSafeHttpsUrl(value.lookup.url)) return "조회 링크는 HTTPS 주소를 입력하세요.";
  if (typeof value.lookup.label !== "string" || !value.lookup.label.trim() || value.lookup.label.length > 80) return "조회 버튼 문구는 1~80자로 입력하세요.";
  if (!value.payout || typeof value.payout !== "object" || Array.isArray(value.payout) || !Array.isArray(value.payout.milestones) || value.payout.milestones.length !== 3) return "지급 기준을 확인하세요.";
  if (!Number.isInteger(value.payout.maxCases) || value.payout.maxCases < 1 || value.payout.maxCases > 3) return "신청 가능 건수는 1~3건으로 설정하세요.";
  let total = 0;
  let lastDay = 0;
  for (const item of value.payout.milestones) {
    if (!item || !Number.isInteger(item.days) || item.days <= lastDay || item.days > 365 || !Number.isInteger(item.amount) || item.amount < 0 || item.amount > 1000000) return "유지 일수와 지급 금액을 확인하세요.";
    total += item.amount;
    lastDay = item.days;
  }
  const totalPayout = total * value.payout.maxCases;
  if (totalPayout > 10000000) return "최대 지급 금액은 1,000만원 이하여야 합니다.";
  if (!value.copy || typeof value.copy !== "object" || Array.isArray(value.copy)) return "화면 안내 문구를 확인하세요.";
  for (const [key, max] of Object.entries(COPY_LIMITS)) {
    const text = value.copy[key];
    if (typeof text !== "string" || text.trim().length < 1 || text.length > max) return `화면 안내 문구(${key})를 확인하세요.`;
  }
  if (!value.operator || typeof value.operator !== "object" || Array.isArray(value.operator)) return "운영자 연락처를 확인하세요.";
  for (const key of ["company", "representative"]) if (typeof value.operator[key] !== "string" || !value.operator[key].trim() || value.operator[key].length > 100) return "운영자 정보를 확인하세요.";
  if (typeof value.operator.email !== "string" || value.operator.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.operator.email)) return "문의 이메일 주소를 확인하세요.";
  if (!value.seo || typeof value.seo !== "object" || Array.isArray(value.seo)) return "검색·공유 안내를 확인하세요.";
  for (const key of ["title", "socialTitle"]) if (typeof value.seo[key] !== "string" || !value.seo[key].trim() || value.seo[key].length > 160) return "검색·공유 제목은 1~160자로 입력하세요.";
  for (const key of ["description", "socialDescription"]) if (typeof value.seo[key] !== "string" || !value.seo[key].trim() || value.seo[key].length > 500) return "검색·공유 설명은 1~500자로 입력하세요.";
  if (value.faqs.filter(item => item.key === "payoutSchedule").length > 1) return "자동 계산 FAQ는 하나만 사용할 수 있습니다.";
  for (const item of value.faqs) if (item.key !== undefined && item.key !== "payoutSchedule") return "지원하지 않는 FAQ 설정입니다.";
  const copyIssue = payoutCopyIssue(value);
  if (copyIssue) return copyIssue;
  return null;
}

function payoutCopyIssue(content) {
  const entries = [
    ["첫 화면 제목", content.headline], ["첫 화면 안내", content.intro],
    ...content.checklist.flatMap((item, index) => [[`참여 단계 ${index + 1} 제목`, item.title], [`참여 단계 ${index + 1} 설명`, item.body]]),
    ...content.faqs.flatMap((item, index) => item.key === "payoutSchedule"
      ? [[`지급 안내 FAQ ${index + 1} 질문`, item.question]]
      : [[`FAQ ${index + 1} 질문`, item.question], [`FAQ ${index + 1} 답변`, item.answer]]),
    ...Object.entries(content.copy).filter(([key]) => !FIXED_PRIVACY_COPY_KEYS.includes(key)).map(([key, text]) => [`화면 문구 ${key}`, text]),
    ...Object.entries(content.seo).map(([key, text]) => [`검색·공유 문구 ${key}`, text])
  ];
  for (const [label, text] of entries) {
    const issue = payoutTextIssue(text, content.payout);
    if (issue === "days") return `화면 문구(${label})의 유지 일수가 지급 기준과 다릅니다. 유지 일수를 확인하세요.`;
    if (issue === "pair") return `화면 문구(${label})의 유지 일수와 지급 금액이 서로 맞지 않습니다. 지급 기준을 확인하세요.`;
    if (issue === "amount") return `화면 문구(${label})의 지급 금액이 현재 기준과 다릅니다. 최대 총액과 단계별 금액을 확인하세요.`;
  }
  return null;
}

function payoutTextIssue(text, payout) {
  const milestones = payout.milestones;
  const allowedDays = new Set(milestones.map(item => item.days));
  const perCase = milestones.reduce((sum, item) => sum + item.amount, 0);
  const total = perCase * payout.maxCases;
  const allowedAmounts = new Set([...milestones.map(item => item.amount), perCase, total]);
  const days = [...text.matchAll(/(\d+)\s*일/g)].map(match => ({ day: Number(match[1]), index: match.index }));
  const payoutContext = /지급|유지|수령|받|금액|단계|조건/.test(text) || days.length > 1;
  if (payoutContext && days.some(({ day }) => !allowedDays.has(day))) return "days";
  const amounts = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(만원|만\s*원|원)/g)].map(match => {
    const number = Number(match[1].replaceAll(",", ""));
    return {
      amount: Math.round(number * (match[2].replaceAll(/\s/g, "").startsWith("만") ? 10000 : 1)),
      index: match.index
    };
  });
  const stageAmounts = amounts.filter(({ amount }) => milestones.some(item => item.amount === amount) && amount !== perCase && amount !== total);
  if (days.length >= 2 && stageAmounts.length === days.length) {
    for (let index = 0; index < days.length; index++) {
      const milestone = milestones.find(item => item.days === days[index].day);
      if (milestone && milestone.amount !== stageAmounts[index].amount) return "pair";
    }
  }
  for (const { amount, index } of amounts) {
    if (!Number.isSafeInteger(amount) || !allowedAmounts.has(amount)) return "amount";
    if (amount === perCase || amount === total) continue;
    const nearestDay = days
      .filter(item => Math.abs(item.index - index) <= 48)
      .sort((left, right) => Math.abs(left.index - match.index) - Math.abs(right.index - match.index))[0];
    if (nearestDay) {
      const milestone = milestones.find(item => item.days === nearestDay.day);
      if (milestone && milestone.amount !== amount) return "pair";
    }
  }
  return null;
}

function safeSupportLinks(links) {
  return Object.fromEntries(["telegram", "line", "channeltalk"].map(key => {
    const link = links?.[key];
    if (typeof link === "string" && link.length <= 500) {
      if (isSafeHttpsUrl(link.trim())) return [key, link.trim()];
    }
    return [key, ""];
  }));
}

export function upgradedV3(stored) {
  const upgraded = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  const storedHeadline = stored.headline.trim();
  upgraded.headline = storedHeadline === "유심 개통 가능하면\n최대 51만원" ? DEFAULT_CONTENT.headline : storedHeadline;
  upgraded.intro = stored.intro.trim();
  upgraded.checklist = stored.checklist.map(item => ({ title: item.title.trim(), body: item.body.trim() }));
  upgraded.faqs = stored.faqs.map(item => {
    const isPayoutFaq = item.question === "지급 금액과 신청 가능 건수는 어떻게 되나요?";
    const outdatedRecruitmentAnswer = item.question === "왜 참여자를 모집하나요?" && item.answer === "유심 개통 실적 향상을 위한 참여 안내입니다.";
    return {
      ...(isPayoutFaq ? { key: "payoutSchedule" } : {}),
      question: item.question.trim(),
      answer: isPayoutFaq ? "" : outdatedRecruitmentAnswer ? DEFAULT_CONTENT.faqs.find(faq => faq.question === item.question).answer : item.answer.trim()
    };
  });
  upgraded.supportLinks = safeSupportLinks(stored.supportLinks);
  if (payoutCopyIssue(upgraded)) {
    if (payoutCopyIssueForText(upgraded.headline, upgraded.payout)) upgraded.headline = DEFAULT_CONTENT.headline;
    if (payoutCopyIssueForText(upgraded.intro, upgraded.payout)) upgraded.intro = DEFAULT_CONTENT.intro;
    upgraded.checklist = upgraded.checklist.map((item, index) => {
      const fallback = DEFAULT_CONTENT.checklist[index];
      return payoutCopyIssueForText(item.title, upgraded.payout) || payoutCopyIssueForText(item.body, upgraded.payout) ? fallback : item;
    });
    upgraded.faqs = upgraded.faqs.filter(item => !payoutCopyIssueForText(item.question, upgraded.payout) && !payoutCopyIssueForText(item.answer, upgraded.payout));
    if (!upgraded.faqs.length) upgraded.faqs = JSON.parse(JSON.stringify(DEFAULT_CONTENT.faqs));
  }
  return upgraded;
}

function payoutCopyIssueForText(text, payout) { return payoutTextIssue(text, payout); }

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    if (!env.CONTENT_DB) return json({ ...DEFAULT_CONTENT, retentionDays: RETENTION_DAYS, cmsReady: false });
    let row;
    try { row = await env.CONTENT_DB.prepare("SELECT content, updated_at FROM site_content WHERE id = ?").bind("home").first(); }
    catch { return json({ ...DEFAULT_CONTENT, retentionDays: RETENTION_DAYS, cmsReady: false, error: "홈페이지 안내 저장소를 불러오지 못했습니다." }, 503); }
    if (!row) return json({ ...DEFAULT_CONTENT, retentionDays: RETENTION_DAYS, cmsReady: true });
    try {
      const stored = JSON.parse(row.content);
      if (stored.schemaVersion === 4 && !validateContent(stored)) {
        const content = {
          ...DEFAULT_CONTENT,
          ...stored,
          copy: { ...stored.copy, ...fixedPrivacyCopy() }
        };
        return json({ ...content, retentionDays: RETENTION_DAYS, updatedAt: row.updated_at, cmsReady: true });
      }
      if (stored.schemaVersion === 3 && !validateV3(stored)) {
        return json({ ...upgradedV3(stored), retentionDays: RETENTION_DAYS, updatedAt: row.updated_at, cmsReady: true, legacyContent: true });
      }
      const supportLinks = safeSupportLinks(stored?.supportLinks);
      return json({ ...DEFAULT_CONTENT, supportLinks, retentionDays: RETENTION_DAYS, updatedAt: row.updated_at, cmsReady: true, legacyContent: true });
    } catch { return json({ ...DEFAULT_CONTENT, retentionDays: RETENTION_DAYS, updatedAt: row.updated_at, cmsReady: true, legacyContent: true }); }
  }

  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  if (!(await isAdminRequest(request, env, { requireOrigin: true }))) return json({ error: "관리자 로그인 또는 요청 출처를 확인할 수 없습니다." }, 401);
  if (!env.CONTENT_DB) return json({ error: "콘텐츠 저장소가 아직 연결되지 않았습니다." }, 503);

  let content;
  try {
    const boundedBody = await readBoundedRequestBody(request, MAX_CONTENT_REQUEST_BYTES);
    if (boundedBody.tooLarge) return json({ error: "요청 크기가 너무 큽니다." }, 413);
    const raw = new TextDecoder().decode(boundedBody.bytes);
    content = JSON.parse(raw);
  } catch { return json({ error: "JSON 형식의 요청이 필요합니다." }, 400); }

  if (!content || typeof content !== "object" || Array.isArray(content)) return json({ error: "잘못된 요청입니다." }, 400);
  if (content.schemaVersion !== 4) return json({ error: "홈페이지 안내 구성이 업데이트되었습니다. 화면을 새로고침한 뒤 다시 저장해 주세요." }, 409);
  const issue = validateContent(content);
  if (issue) return json({ error: issue }, 400);
  const lockedPrivacyCopy = fixedPrivacyCopy();
  const safe = {
    schemaVersion: 4,
    headline: content.headline.trim(), intro: content.intro.trim(),
    checklist: content.checklist.map(x => ({ title: x.title.trim(), body: x.body.trim() })),
    faqs: content.faqs.map(x => ({ ...(x.key === "payoutSchedule" ? { key: x.key } : {}), question: x.question.trim(), answer: x.answer.trim() })),
    supportLinks: safeSupportLinks(content.supportLinks),
    lookup: { url: content.lookup.url.trim(), label: content.lookup.label.trim() },
    payout: { milestones: content.payout.milestones.map(x => ({ days: x.days, amount: x.amount })), maxCases: content.payout.maxCases },
    operator: { company: content.operator.company.trim(), representative: content.operator.representative.trim(), email: content.operator.email.trim() },
    seo: Object.fromEntries(["title", "description", "socialTitle", "socialDescription"].map(key => [key, content.seo[key].trim()])),
    copy: Object.fromEntries(Object.keys(DEFAULT_CONTENT.copy).map(key => [key, lockedPrivacyCopy[key] ?? content.copy[key].trim()]))
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
      if (!current || current.schemaVersion !== 4 || validateContent(current)) {
        await env.CONTENT_DB.prepare("INSERT INTO site_content (id, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING")
          .bind("home_legacy", previous.content, previous.updated_at || updatedAt).run();
      }
    }
    await env.CONTENT_DB.prepare("INSERT INTO site_content (id, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at")
      .bind("home", JSON.stringify(safe), updatedAt).run();
  } catch {
    return json({ error: "홈페이지 안내를 저장하지 못했습니다. 잠시 후 다시 확인해 주세요." }, 503);
  }
  await invalidatePublicHomeCache();
  return json({ content: safe, retentionDays: RETENTION_DAYS, updatedAt });
}

export function fixedPrivacyCopy() {
  return Object.fromEntries(FIXED_PRIVACY_COPY_KEYS.map(key => [key, DEFAULT_CONTENT.copy[key]]));
}

async function invalidatePublicHomeCache() {
  try {
    if (globalThis.caches?.default) await globalThis.caches.default.delete(new Request("https://climekr.com/"));
  } catch {}
}
