/**
 * Deterministic Korean review corpus for import (unique bodies, dedup-safe).
 * Voice: 급전이 필요하고 대출은 안 됨 → 이 유심 플랫폼이 자금을 마련해 문제가 해결됨.
 * 페르소나(주부·직장인·대학생·사업자·육아맘·경단녀)가 글마다 분명함.
 * 대학생은 용돈이 필요했던 경우, 사업자는 사업자금이 부족했던 경우.
 * 대학생은 20–30대 구어. 나머지 페르소나는 20–70대에 걸쳐 나이 말투를 탄다.
 * 회사가 절차를 진행, 고객은 사진 캡처, 고객 부담 0원, 회사·통신사 실적 목적.
 * 가족에게 전달·설명·안내 문구를 넘기는 문장은 넣지 않는다.
 * 번호이동·개통만 다룬 후기가 아님.
 *
 * Calendar: every 년/월/일 in a body is that row's publishedAt in Asia/Seoul.
 * Time of day ("오전에", "저녁에") follows the same instant. No "N분경" stamps.
 * Sentence skeleton: after Seoul dates, weekdays, times of day, and the row's
 * masked display name are removed, all 10,000 remaining texts differ.
 *
 * Speech-pattern research (paraphrased into pools; not copied verbatim):
 * - https://m.blog.naver.com/true-water/222644750313 — 연속 대출 거절·시도 회차·감탄(ㅠㅠ) 후기 흐름
 * - https://finda.co.kr/finposts/finance230810 — 거절 사유(신용·소득·기대출) 점검형 서술
 * - https://www.banksalad.com/articles/P2P-%EC%8B%A0%EC%9A%A9%EB%8C%80%EC%B6%9C-%EC%86%8C%EA%B0%9C — 은행 거절 후 대안 탐색 톤
 * - https://m.blog.naver.com/minjae0701/221205786148 — 선불유심 유지 조건·상담 신청 후기형 표현
 * - https://m.blog.naver.com/kuidaz1/222610281305 — 카카오/채널 상담·온라인 개통 안내 문맥
 * - https://m.kin.naver.com/qna/dirs/1070202/docs/448137902 — 후기 확인 후 상담 연락 권유 패턴
 * - https://gall.dcinside.com/mgallery/board/view/?id=daya&no=66 — 거절 시 순서대로 점검하는 현실 조언체
 * - https://m.blog.naver.com/kuidaz1/224399403057 — 상담 중 조건·기기 차이 Q&A형 전개
 * - https://m.blog.naver.com/zoyizoyi/221443083245 — 채널톡 도입·실시간 상담 후기 리듬
 */
import { createHash } from "node:crypto";
import {
  REVIEW_BODY_MIN,
  REVIEW_BODY_MAX,
  makeSnippet,
  normalizeForDedup,
  normalizeReviewBody
} from "../functions/_lib/reviews.js";

function sha256HexSync(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Sync triple-hash check while building the corpus (matches reviewHashes). */
function dedupHashesForBody(body) {
  const normalized = normalizeReviewBody(body);
  const snippet = makeSnippet(normalized);
  return {
    body_sha256: sha256HexSync(normalized),
    body_norm_sha256: sha256HexSync(normalizeForDedup(body)),
    snippet_sha256: sha256HexSync(snippet),
    snippet
  };
}

/** Bump when corpus voice/templates change so seed cache files regenerate. */
export const REVIEW_CORPUS_VERSION = "usim-persona-funds-2026-10-27";

const CHANNELS = ["channeltalk", "telegram", "line"];
const STAGES = ["3", "15", "30", "consult"];

const CHANNEL_PHRASE = {
  channeltalk: { to: "채널톡으로", at: "채널톡에서", name: "채널톡" },
  telegram: { to: "텔레그램으로", at: "텔레그램에서", name: "텔레그램" },
  line: { to: "LINE으로", at: "LINE에서", name: "LINE" }
};

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
const GIVEN_TAIL = ["민", "준", "서", "현", "우", "진", "영", "희", "수", "연", "호", "윤", "아", "성", "경", "혜", "택", "빈", "람", "솔"];

/**
 * Need clauses tied to one persona.
 * Casual `because` can lead a sentence; `formal` is the 하여-체 parallel.
 * 대학생 topics stay on 용돈. 사업자 topics stay on 사업자금.
 */
const PERSONA_SITUATIONS = {
  "주부": [
    { topic: "생활비", because: "생활비가 모자라서", formal: "생활비가 부족하여" },
    { topic: "가계 비용", because: "가계가 비어서", formal: "가계가 비어" },
    { topic: "공과금", because: "공과금이 겹쳐서", formal: "공과금이 겹쳐" },
    { topic: "월세", because: "월세가 다가와서", formal: "월세 날이 다가와" },
    { topic: "장보기", because: "장보기 비용이 빠져서", formal: "장보기 비용이 빠져" }
  ],
  "직장인": [
    { topic: "월급 전 생활비", because: "월급 전 생활비가 막혀서", formal: "월급 전 생활비가 막혀" },
    { topic: "카드값", because: "카드값이 밀려서", formal: "카드값이 밀려" },
    { topic: "전세자금", because: "전세자금이 묶여서", formal: "전세자금이 묶인 탓에" },
    { topic: "카드론", because: "카드론까지 막혀서", formal: "카드론까지 막혀" },
    { topic: "결제일", because: "결제일이 몰려서", formal: "결제일이 몰려" }
  ],
  "대학생": [
    { topic: "용돈", because: "용돈이 필요해서", formal: "용돈이 필요하여" },
    { topic: "용돈", because: "용돈이 끊겨서", formal: "용돈이 끊겨" },
    { topic: "용돈", because: "학식비 낼 용돈이 없어서", formal: "학식비 낼 용돈이 없어" },
    { topic: "용돈", because: "자취 월세 낼 용돈이 빠져서", formal: "자취 월세 낼 용돈이 빠져" },
    { topic: "용돈", because: "교재 살 용돈이 모자라서", formal: "교재 살 용돈이 모자라" }
  ],
  "사업자": [
    { topic: "사업자금", because: "사업자금이 부족해서", formal: "사업자금이 부족하여" },
    { topic: "사업자금", because: "재료 살 사업자금이 없어서", formal: "재료 살 사업자금이 없어" },
    { topic: "사업자금", because: "매출이 비어 사업자금이 막혀서", formal: "매출이 비어 사업자금이 막혀" },
    { topic: "사업자금", because: "거래처 대금 낼 사업자금이 없어서", formal: "거래처 대금 낼 사업자금이 없어" },
    { topic: "사업자금", because: "가게 운영 사업자금이 빠져서", formal: "가게 운영 사업자금이 빠져" }
  ],
  "육아맘": [
    { topic: "육아비", because: "육아비가 겹쳐서", formal: "육아비가 겹쳐" },
    { topic: "분유값", because: "분유값이 빠져서", formal: "분유값이 빠져" },
    { topic: "어린이집 비용", because: "어린이집 비용이 겹쳐서", formal: "어린이집 비용이 겹쳐" },
    { topic: "아이 병원비", because: "아이 병원비가 나와서", formal: "아이 병원비가 나와" },
    { topic: "기저귀 값", because: "기저귀 값이 빠져서", formal: "기저귀 값이 빠져" }
  ],
  "경단녀": [
    { topic: "생활비", because: "경력이 끊겨 생활비가 막혀서", formal: "경력 단절 뒤 생활비가 막혀" },
    { topic: "재취업 비용", because: "재취업 준비 비용이 없어서", formal: "재취업 준비 비용이 없어" },
    { topic: "급전", because: "소득이 끊겨 급전이 필요해서", formal: "소득이 끊겨 급전이 필요하여" },
    { topic: "자격 학원비", because: "자격 학원비가 겹쳐서", formal: "자격 학원비가 겹쳐" },
    { topic: "공과금", because: "벌어 둔 돈이 없어 공과금이 막혀서", formal: "벌어 둔 돈이 없어 공과금이 막혀" }
  ]
};

const SHOTS = ["캡처 화면", "요금 화면", "명의 화면", "회선 상태 화면", "유심 실물 사진", "캡처 한 장", "요금 문자 화면", "본인 확인 화면"];
const DOCS = ["0원 안내", "지급 안내", "회사 절차 안내", "유지 조건 안내", "자격 안내", "비용 부담 안내", "자동 안내", "상담 안내"];
const WORRIES = [
  "추가 비용이 붙는지",
  "신용조회가 한 번 더 도는지",
  "본인 명의만으로 되는지",
  "당일 입금이 되는지",
  "위약이 있는지",
  "서류가 더 필요한지",
  "회선 유지가 본인 책임인지",
  "중도에 빠져도 되는지",
  "지급이 유지 기간에 묶이는지",
  "본인 부담이 정말 0원인지"
];

const CLOSER_CASUAL = {
  "20s": {
    5: [
      "설명 순서가 일정해서 믿고 진행해 봤어요.",
      "궁금한 걸 다시 물어도 답이 같아서 마음이 놓였어요.",
      "이 정도면 조건 보고 결정해도 되겠어요.",
      "급하게 본 것치고는 정리가 잘 돼 있었어요."
    ],
    4: [
      "사진이 한 번 흔들려 다시 보낸 것만 번거로웠어요.",
      "당일은 아니라 일정은 따로 적어 뒀어요.",
      "표가 촘촘해 한 번은 다시 읽었지만 핵심은 명확했어요.",
      "답이 조금 늦었던 것 말고는 안내가 깔끔했어요."
    ],
    3: [
      "급한 돈은 해결됐는데 회선 안내가 조금 헷갈려 아쉬웠어요.",
      "자금은 마련됐는데 진행이 느려 그 점은 아쉬웠어요.",
      "필요한 돈은 들어왔는데 유지 계산이 헷갈려 아쉬웠어요.",
      "문제는 풀렸는데 조건 표가 조금 촘촘해 아쉬웠어요."
    ]
  },
  "30s": {
    5: [
      "조건이 짧아서 한 번 읽고 바로 이해할 수 있었어요.",
      "같은 질문을 나눠 물어도 기준이 안 흔들려서 신뢰가 갔어요.",
      "필요한 자금이 마련돼 막혔던 일이 해결됐어요.",
      "급전을 찾다 들어온 창치고는 압박이 없었어요."
    ],
    4: [
      "캡처를 한 장 다시 찍은 것 말고는 흐름이 매끄러웠어요.",
      "당일 지급이 아니라 달력에 유지 기간만 표시해 뒀어요.",
      "안내 글이 조금 길어 두 번 읽은 점은 아쉬웠어요.",
      "첫 답이 늦은 것만 빼고는 내용이 분명했어요."
    ],
    3: [
      "급한 돈은 해결됐는데 명의 안내를 두 번 읽게 됐어요.",
      "자금은 들어왔는데 진행이 길어 기다린 점이 아쉬웠어요.",
      "문제는 풀렸는데 표 계산이 한 번에 안 들어왔어요.",
      "돈은 마련됐는데 설명이 조금 길어 아쉬웠어요."
    ]
  },
  "40s": {
    5: [
      "필요한 말만 있어 읽고 조건을 비교하기 수월했어요.",
      "처음 들은 기준과 나중 안내가 같아서 마음이 놓였어요.",
      "대출 대신 이 경로로 돈이 들어와 문제가 풀렸어요.",
      "급하게 알아본 상담치고는 정돈이 잘 돼 있었어요."
    ],
    4: [
      "사진이 번져 한 차례 다시 보낸 점만 번거로웠어요.",
      "당일 입금은 아니라 일정은 따로 받아 적었어요.",
      "표가 촘촘해 한 번 더 확인한 것 외에는 명확했어요.",
      "답장이 약간 늦었지만 내용 자체는 분명했어요."
    ],
    3: [
      "급한 돈은 해결됐는데 회선 조건을 다시 확인한 점이 번거로웠어요.",
      "자금은 마련됐는데 진행이 느려 기다림이 있었어요.",
      "문제는 풀렸는데 유지 기간 계산이 한 번에 안 들어왔어요.",
      "필요한 돈은 마련됐는데 안내가 길어 아쉬웠어요."
    ]
  }
};

const CLOSER_FORMAL = {
  "50s": {
    5: [
      "안내 순서가 일정하여 조건을 이해하고 진행했습니다.",
      "같은 질문을 다시 드려도 기준이 흔들리지 않았습니다.",
      "필요한 자금이 마련되어 막혔던 일이 해결되었습니다.",
      "급한 자금 상황에서 본 상담치고는 정돈이 잘 되어 있었습니다."
    ],
    4: [
      "사진이 흐려 한 차례 다시 보낸 점만 번거로웠습니다.",
      "당일 지급은 아니었으나 일정은 미리 알 수 있었습니다.",
      "표가 다소 촘촘하여 한 번 더 읽었으나 핵심은 명확했습니다.",
      "첫 답변이 조금 늦었으나 내용 자체는 분명했습니다."
    ],
    3: [
      "급한 자금은 해결되었으나 회선 안내를 다시 읽은 점이 번거로웠습니다.",
      "자금은 마련되었으나 진행이 느려 기다린 점이 아쉬웠습니다.",
      "문제는 해결되었으나 유지 기간 계산이 한 번에 이해되지 않았습니다.",
      "필요한 자금은 마련되었으나 안내가 길어 아쉬웠습니다."
    ]
  },
  "60s": {
    5: [
      "필요한 설명이 간결하여 조건을 비교하기 수월했습니다.",
      "초기 안내와 이후 답변이 같아 신뢰할 수 있었습니다.",
      "대출 대신 이 경로로 자금이 들어와 문제가 해결되었습니다.",
      "급한 마음에 문의했으나 절차 설명은 차분했습니다."
    ],
    4: [
      "사진을 한 번 다시 보낸 것 외에는 무리 없이 진행되었습니다.",
      "당일 입금이 아님을 미리 안내받아 일정을 조정했습니다.",
      "표가 촘촘해 두 번 확인했으나 금액 기준은 분명했습니다.",
      "답변이 다소 늦었으나 안내 내용은 명확했습니다."
    ],
    3: [
      "급한 자금은 해결되었으나 명의 안내를 다시 확인했습니다.",
      "자금은 마련되었으나 진행이 느려 기다렸습니다.",
      "문제는 해결되었으나 계산이 한 번에 이해되지 않았습니다.",
      "필요한 자금은 마련되었으나 안내가 다소 길었습니다."
    ]
  },
  "70s": {
    5: [
      "안내가 간결하여 납득하고 진행했습니다.",
      "추가 질문에도 같은 기준으로 답하여 신뢰가 갔습니다.",
      "조건이 분명하였고 필요한 자금이 마련되어 문제가 해결되었습니다.",
      "전반적으로 차분한 안내라 마음이 놓였습니다."
    ],
    4: [
      "사진 재전송이 한 차례 있었으나 조건 설명은 명확했습니다.",
      "당일 지급은 아니었으나 일정을 미리 확인할 수 있었습니다.",
      "표가 다소 촘촘했으나 핵심 금액은 분명했습니다.",
      "답변이 조금 늦었으나 이후 안내는 일관되었습니다."
    ],
    3: [
      "급한 자금은 해결되었으나 회선 안내를 다시 확인하였습니다.",
      "자금은 마련되었으나 진행이 느려 기다렸습니다.",
      "문제는 해결되었으나 현재 안내가 다소 길었습니다.",
      "필요한 자금은 마련되었으나 읽는 데 시간이 걸렸습니다."
    ]
  }
};

const WEEKDAY_KO = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" };

/** @param {Date} date */
export function kstCalendarParts(date) {
  const bag = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23"
  }).formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const digits = (value) => Number(String(value ?? "").replace(/[^\d]/g, ""));
  let hour = digits(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: digits(bag.year),
    month: digits(bag.month),
    day: digits(bag.day),
    hour,
    minute: digits(bag.minute),
    weekday: WEEKDAY_KO[bag.weekday] || bag.weekday
  };
}

function todOptions(hour, weekday, persona) {
  const weekend = weekday === "토" || weekday === "일";
  const commutes = persona === "직장인" || persona === "사업자";
  if (hour < 3) return ["밤중에", "새벽에"];
  if (hour < 6) return ["새벽에"];
  if (hour < 11) return weekend || !commutes ? ["오전에", "아침 일찍"] : ["오전에", "출근 전에"];
  if (hour < 12) return ["오전에", "오전 중에"];
  if (hour < 14) return ["점심에", "점심시간에"];
  if (hour < 18) return ["오후에", "오후 중에"];
  if (hour < 22) return weekend || !commutes ? ["저녁에", "저녁 무렵에"] : ["저녁에", "퇴근하고"];
  return ["밤에", "늦은 밤에"];
}

/** @param {number} seed */
function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index + salt combinatorics (deterministic; reduces rng-only template repetition). */
function pickAt(arr, i, salt) {
  const u = Math.imul(i ^ salt, 0x9e3779b1) >>> 0;
  return arr[u % arr.length];
}

function otherOf(arr, current, i, salt) {
  const picked = pickAt(arr, i, salt);
  if (picked !== current) return picked;
  return arr[(arr.indexOf(current) + 1) % arr.length];
}

function pickDistinct(arr, i, salt, n) {
  const out = [];
  const used = new Set();
  let lane = 0;
  while (out.length < n && lane < n + arr.length + 2) {
    const item = pickAt(arr, i + lane, salt + lane * 17);
    if (!used.has(item)) {
      used.add(item);
      out.push(item);
    }
    lane += 1;
  }
  return out;
}

/**
 * Deterministic pseudo-age bucket from row index (20s–70s).
 * @param {number} i 1-based row index
 */
export function ageBucketForIndex(i) {
  const buckets = ["20s", "30s", "40s", "50s", "60s", "70s"];
  return buckets[(i - 1) % buckets.length];
}

export function isFormalAgeBucket(bucket) {
  return bucket === "50s" || bucket === "60s" || bucket === "70s";
}

/**
 * 대학생 is only 20s–30s casual. The other five personas span the age buckets.
 * Lane is the index within one age bucket (rows step by 6).
 */
const PERSONA_BY_BUCKET = {
  "20s": ["대학생", "대학생", "대학생", "대학생", "직장인", "주부", "육아맘", "사업자"],
  "30s": ["직장인", "주부", "육아맘", "사업자", "경단녀", "대학생", "경단녀", "주부"],
  "40s": ["주부", "직장인", "사업자", "육아맘", "경단녀"],
  "50s": ["직장인", "사업자", "육아맘", "경단녀", "주부"],
  "60s": ["사업자", "육아맘", "경단녀", "주부", "직장인"],
  "70s": ["육아맘", "경단녀", "주부", "직장인", "사업자"]
};

export function personaForIndex(i) {
  const bucket = ageBucketForIndex(i);
  const lane = Math.floor((i - 1) / 6);
  const pool = PERSONA_BY_BUCKET[bucket];
  return pool[lane % pool.length];
}

/**
 * Corpus rating mix targeting mean exactly 4.8 on a 5-point scale (integer stars).
 * For count divisible by 5: 5·n5 + 4·n4 + 3·n3 = (48/10)·count, with n5 + n4 + n3 = count.
 * Mostly 4–5 stars: n5 = (4/5)·count + n3, n4 = count/5 − 2·n3 (0 ≤ n3 ≤ count/10).
 * At count=10_000 with n3=100: 8100×5 + 1800×4 + 100×3 → 48000/10000 = 4.8.
 */
function ratingCountsForCorpus(count) {
  const n3 = count >= 1000 ? Math.min(100, Math.floor(count / 100)) : 0;
  const n4 = Math.floor(count / 5) - 2 * n3;
  const n5 = count - n4 - n3;
  return { 3: n3, 4: n4, 5: n5 };
}

function ratingForIndex(i, count) {
  const { 3: n3, 4: n4 } = ratingCountsForCorpus(count);
  const slot = ((i - 1) * 7919) % count;
  if (slot < n3) return 3;
  if (slot < n3 + n4) return 4;
  return 5;
}

export function ratingDistributionForCorpus(count = 10_000) {
  return ratingCountsForCorpus(count);
}

function displayNameFor(i, rng, formal) {
  const surname = SURNAMES[(i * 3 + 7) % SURNAMES.length];
  const tail = GIVEN_TAIL[(i * 11 + 5) % GIVEN_TAIL.length];
  const head = GIVEN_TAIL[(i * 17) % GIVEN_TAIL.length];
  if (formal) {
    if (rng() < 0.55) return `${surname}${head}${tail}*`;
    return `${surname}${head}*`;
  }
  if (rng() < 0.35) return `${surname}*${tail}`;
  if (rng() < 0.6) return `${surname}${head}*`;
  return `${surname}${head}${tail.slice(0, 1)}*`;
}

function whenPhrase(kst, i, salt, persona) {
  const tod = pickAt(todOptions(kst.hour, kst.weekday, persona), i, 4 + salt);
  const md = `${kst.month}월 ${kst.day}일`;
  const ymd = `${kst.year}년 ${md}`;
  const wd = `${kst.weekday}요일`;
  return pickAt(
    [`${md} ${tod}`, `${ymd} ${tod}`, `${md} ${wd} ${tod}`, `${wd}인 ${md} ${tod}`],
    i,
    8 + salt
  );
}

function stageBit(stage) {
  if (stage === "3" || stage === "15" || stage === "30") return `${stage}일 유지 조건`;
  return "상담 조건";
}

function casualStory(ctx) {
  const { when, because, topic, chTo, chAt, chName, shot, doc, worry, stageName } = ctx;
  return [
    `${when} ${because} ${chTo} 유심 플랫폼 상담을 열었어요. ${shot}만 보내면 되고 비용은 0원이라는 안내를 받았어요.`,
    `${worry} 궁금해서 ${when} ${chAt} USIM PLUS 담당자에게 먼저 물어봤어요. ${doc}랑 회사 절차를 같이 보내 줘서 급전만 헤매던 때보다 순서가 보였어요.`,
    `사기인가 싶어 미루다가 ${when} ${because} 결국 ${chName}으로 유심 플랫폼 안내를 봤어요. 대출 권유 대신 자격 확인 후 지급이라는 말이 먼저 나왔고, 본인 부담은 0원이라고 했어요.`,
    `같은 처지라던 지인이 ${chName}을 알려 줘서 ${when} ${topic} 건으로 들어가 봤어요. USIM PLUS 창에 ${shot} 예시가 있고, 회사 쪽에서 절차를 맡는다고 적혀 있었어요.`,
    `대출이 안 된 뒤 ${topic} 문제로 ${when} ${chAt} 유심 플랫폼 상담을 남겼어요. 회사와 통신사 실적 목적의 절차로 자금이 마련됐고, 제가 한 일은 ${shot}뿐이었어요.`,
    `당일 입금을 기대하고 ${when} ${because} ${chTo} 유심 플랫폼에 문의했어요. 유지 기간을 채운 뒤 지급이라고 먼저 말해 줬고, ${stageName}이랑 ${doc}가 한 화면에 있었어요.`,
    `${when} ${chAt} ${shot}을 올렸더니 초점이 안 맞아 한 번 다시 찍었어요. 이유는 짚어 줬고, 비용 0원이랑 회사 절차라는 말도 그 김에 다시 확인했어요.`,
    `여기저기 급전을 알아보다 ${when} ${chAt} 연 유심 플랫폼만 톤이 달랐어요. ${because} 온 건데 몰아붙이지 않고 ${worry}부터 답해 줬어요.`,
    `${stageName}이 얼마나 다른지 보려고 ${when} ${chTo} 들어갔어요. ${topic} 기준으로 어디인지 바로 보였고, ${shot} 외에는 시킬 일이 없었어요. 0원이라는 칸도 따로 있었어요.`,
    `${when} 일단 ${chAt} 링크만 저장해 뒀다가 조금 있다 다시 읽었어요. ${because} 급한 마음이었는데 자동 안내가 끊기지 않아 어디까지 봤는지 남았어요. USIM PLUS 담당자 문구랑 ${doc} 예시가 같이 있었어요.`,
    `${topic} 때문에 검색만 하다 ${when} 반신반의로 ${chTo} 유심 플랫폼에 말을 걸었어요. 불법 대출이 아니라는 설명, 회사 절차, 본인 부담 0원이 한 메시지에 들어 있었어요.`,
    `${when} 잠깐 시간을 내 ${chAt} 유심 플랫폼에 짧게 물어봤어요. ${worry}에 대한 답이 두 줄로 왔고, ${shot}만 준비하면 된다고 했어요.`,
    `${when} ${because} 잠깐 한숨 돌리면서 ${chName}을 열었어요. 유심 플랫폼 쪽은 서류 더미가 아니라 ${shot}으로 자격부터 봤어요. 지급 얘기는 ${stageName}을 본 뒤에 나왔어요.`,
    `${when} ${topic} 건으로 ${chTo} 상담했어요. 담당자가 숫자를 캐묻지 않고 ${doc}랑 0원 범위부터 보여 줬어요. ${shot} 예시도 같이 와서 회사 절차만 기다리면 됐어요.`,
    `후기를 몇 개 읽고 ${when} ${because} ${chAt} USIM PLUS에 들어갔어요. ${worry}를 먼저 적었더니 ${doc}로 답해 줬어요.`,
    `${shot}만 보내면 되나 싶어 ${when} ${chTo} 유심 플랫폼을 열었어요. 본인 부담은 0원이고 절차는 회사 쪽이라고 적혀 있었어요.`,
    `담당자 연결이 되는지 보려고 ${when} ${chAt} 말을 걸었어요. ${because} 사정을 적으니 ${stageName} 표랑 ${doc}를 바로 집어 줬어요. 사진 캡처 외 서류는 없다고 했어요.`,
    `급전 창구를 돌다 ${when} ${chAt} 받은 상담만 말투가 달랐어요. 유심 플랫폼이라 자격부터 보고, ${shot}만 있으면 회사 절차로 이어진다고 했어요.`
  ];
}

function formalStory(ctx) {
  const { when, formalBecause, topic, chTo, chAt, chName, shot, doc, worry, stageName } = ctx;
  return [
    `${when} ${formalBecause} ${chTo} 유심 플랫폼 상담을 시작했습니다. ${shot} 위주로 제출하면 되며 이용자 부담은 0원임을 확인했습니다.`,
    `${worry}부터 확인하고자 ${when} ${chAt} USIM PLUS 담당자에게 문의했습니다. ${doc}와 회사 절차를 함께 안내해 주어 급히 자금을 찾던 상황에서도 순서가 보였습니다.`,
    `처음에는 신뢰하기 어려웠으나 ${when} ${formalBecause} ${chName}으로 유심 플랫폼 안내를 받아 보았습니다. 대출 중개와 달리 자격 확인 후 지원·지급이라는 점을 먼저 설명했습니다.`,
    `${topic} 때문에 어려움을 겪던 지인의 소개로 ${when} ${chTo} 접속했습니다. USIM PLUS 화면에 ${shot} 예시가 있었고, 절차는 회사 측에서 진행한다고 적혀 있었습니다.`,
    `대출이 되지 않은 뒤 ${topic} 문제로 ${when} ${chAt} 유심 플랫폼 상담을 남겼습니다. 회사와 통신사 실적 목적의 절차로 자금이 마련되었고, 이용자가 한 일은 ${shot}뿐이었습니다.`,
    `당일 입금을 기대하고 ${when} ${formalBecause} ${chTo} 유심 플랫폼에 문의했습니다. 유지 기간 이후 지급임을 먼저 안내받았고, ${stageName}과 ${doc}가 같은 화면에 있었습니다.`,
    `${when} ${chAt} ${shot}을 전송하였으나 초점이 맞지 않아 한 차례 다시 촬영했습니다. 사유를 함께 알려 주었고, 비용 0원과 회사 절차라는 안내도 다시 확인했습니다.`,
    `급한 자금을 알아보던 중 ${when} ${chAt} 본 유심 플랫폼 안내의 톤이 달랐습니다. ${formalBecause} 문의한 것인데 ${worry}부터 답변해 주었습니다.`,
    `${stageName}의 차이를 확인하려고 ${when} ${chTo} 들어갔습니다. ${topic} 기준으로 해당 칸이 바로 보였고, ${shot} 외에는 이용자가 할 일이 적었습니다. 0원 안내도 별도로 있었습니다.`,
    `${when} ${chAt} 링크를 저장해 두었다가 조금 뒤 다시 읽었습니다. ${formalBecause} 상황이었으나 자동 안내가 중단되지 않아 진행 위치가 남아 있었습니다. USIM PLUS 담당자 문구와 ${doc} 예시가 함께 있었습니다.`,
    `${topic} 문제로 자료를 찾다 ${when} ${chTo} 유심 플랫폼에 문의했습니다. 불법 대출이 아니라는 설명, 회사 절차, 이용자 부담 0원이 한 메시지에 들어 있었습니다.`,
    `${when} 시간을 내어 ${chAt} 유심 플랫폼에 짧게 문의했습니다. ${worry}에 대한 답이 두 문장으로 왔고, ${shot}만 준비하면 된다고 했습니다.`,
    `${when} ${formalBecause} 잠깐 한숨 돌리며 ${chName}을 열었습니다. 유심 플랫폼은 서류보다 ${shot}으로 자격부터 확인한다고 안내했습니다. 지급 설명은 ${stageName}을 본 뒤에 나왔습니다.`,
    `${when} ${topic} 건으로 ${chTo} 상담했습니다. 담당자는 불필요한 수치를 묻지 않고 ${doc}와 0원 범위부터 보여 주었습니다. ${shot} 예시도 함께 와서 회사 절차를 기다리면 되었습니다.`,
    `후기를 살펴본 뒤 ${when} ${formalBecause} ${chAt} USIM PLUS에 들어갔습니다. ${worry}를 먼저 적었더니 ${doc}로 답변이 왔습니다.`,
    `${shot}만 제출하면 되는지 확인하려고 ${when} ${chTo} 유심 플랫폼을 열었습니다. 이용자 부담은 0원이고 절차는 회사 측이라고 적혀 있었습니다.`,
    `담당자 연결 여부를 확인하려고 ${when} ${chAt} 문의했습니다. ${formalBecause} 사정을 적으니 ${stageName} 표와 ${doc}를 바로 지정해 주었습니다. 사진 캡처 외 서류는 필요하지 않다고 했습니다.`,
    `급한 자금을 알아보던 ${when} ${chAt} 받은 상담의 말투가 달랐습니다. 유심 플랫폼이라 자격부터 확인하고, ${shot}만 있으면 회사 절차로 이어진다고 했습니다.`
  ];
}

function casualExtras(ctx) {
  const { altShot, altDoc, stageName, topic, worry } = ctx;
  return [
    `${altShot} 예시를 보고 같은 구도로 찍어 보냈어요.`,
    `${altDoc} 내용이 대화에 남아 나중에 다시 읽기 좋았어요.`,
    `${stageName}이 표에 따로 있어 말로만 듣는 것보다 비교가 됐어요.`,
    "본인 명의 회선은 본인이 유지해야 한다는 말도 빠지지 않았어요.",
    "불법 대출처럼 회유하는 말은 없어서 톤이 달랐어요.",
    "자동으로 다음 안내가 이어져 어디서 멈춘 건지 표시가 됐어요.",
    "지급은 유지 기간을 채운 뒤라는 점을 먼저 말해서 기대를 낮췄어요.",
    "고객 부담 0원으로 진행됐고 급한 돈 문제는 여기서 해결됐어요.",
    "진행 중에 조건이 바뀌는지 물었더니 표 밖으로는 안 바뀐다고 했어요.",
    "상담 링크를 저장해 두고 같은 날 다시 열어 확인했어요.",
    "통신사 실적이랑 회사 실적 때문에 참여자를 모은다는 설명도 있었어요.",
    "번호만 옮기라는 창은 아니었고 자격 확인이 먼저였어요.",
    `${topic} 때문에 왔다고 적었더니 그 기준으로 표를 집어 줬어요.`,
    `${worry}는 대화 첫머리에 이미 적혀 있었어요.`,
    "회사 부담 범위를 한 줄로 더 적어 달라고 했더니 바로 달아 줬어요.",
    "궁금한 문장만 짧게 물어도 답이 돌아와서 대화가 길지 않았어요."
  ];
}

function formalExtras(ctx) {
  const { altShot, altDoc, stageName, topic, worry } = ctx;
  return [
    `${altShot} 예시를 보고 같은 구도로 촬영하여 제출했습니다.`,
    `${altDoc} 내용이 상담창에 남아 나중에 다시 확인하기 수월했습니다.`,
    `${stageName}이 표로 구분되어 있어 비교가 가능했습니다.`,
    "본인 명의 회선 유지는 본인 책임이라는 안내도 함께 있었습니다.",
    "불법 대출처럼 회유하는 표현은 없어 상담 톤이 달랐습니다.",
    "자동으로 다음 안내가 이어져 진행 위치가 표시되었습니다.",
    "지급은 유지 기간을 채운 뒤라는 점을 먼저 안내받아 기대치를 조정했습니다.",
    "이용자 부담 0원으로 진행되었고 급한 자금 문제는 해결되었습니다.",
    "진행 중 조건 변경 여부를 문의하니 표에 적힌 범위라고 답했습니다.",
    "상담 링크를 저장해 두고 같은 날 다시 열어 확인했습니다.",
    "통신사 실적과 회사 실적을 위해 참여자를 모은다는 배경 설명도 있었습니다.",
    "번호만 변경하라는 상담은 아니었고 자격 확인이 먼저였습니다.",
    `${topic} 문제로 문의했다고 적었더니 그 기준으로 표를 지정해 주었습니다.`,
    `${worry}는 첫 안내에 이미 적혀 있었습니다.`,
    "회사 부담 범위를 한 문장으로 다시 적어 달라고 요청하니 바로 달아 주었습니다.",
    "필요한 질문만 짧게 드려도 답이 돌아와 대화가 길지 않았습니다."
  ];
}

function casualLong(ctx) {
  const { topic, worry, chAt, stageName, altShot, altDoc, because } = ctx;
  return [
    `${topic} 건으로 신용이 더 깎일까 봐 ${chAt} 묻기 전에는 망설였어요. 조회를 여러 번 넣는 구조는 아니라고 해서, ${worry} 걱정은 그다음에 내려놓았어요.`,
    `${altDoc}를 읽고 나니 제가 통신사 앱을 직접 만질 단계는 거의 없었어요. ${altShot}만 맞추면 나머지는 회사 절차로 넘어간다고 적혀 있었어요.`,
    `${chAt} 안내를 다시 읽어도 부담 주체가 회사 쪽이라는 표현이 같았어요. 통신사 실적을 위한 절차라는 점도 같았어요.`,
    `${stageName}을 보고 고르는 구조라 표만 천천히 읽었어요. 당장을 바랐던 마음과는 달랐지만 조건을 숨기지는 않았어요.`,
    `상담이 끝난 뒤에도 ${chAt} 같은 창으로 직전 안내를 다시 열 수 있었어요. ${topic} 때문에 급했는데 재촉하는 문자는 따로 안 왔어요.`,
    `다른 사람 명의를 빌려 달라는 말은 없었고 본인 회선으로만 본다고 했어요. ${worry}를 적어 둔 답이랑도 어긋나지 않았어요.`,
    `${because} 들어온 티가 나게 첫 문장을 길게 적었더니 그 기준으로만 안내가 돌아왔어요. 다른 상품을 끼워 팔지는 않았어요.`,
    `${altShot}이 흐리면 예시와 나란히 보여 줘서 어디가 잘렸는지 알 수 있었어요. 그 한 번 말고는 추가 서류를 요구하지 않았어요.`
  ];
}

function formalLong(ctx) {
  const { topic, worry, chAt, stageName, altShot, altDoc, formalBecause } = ctx;
  return [
    `${topic} 건으로 신용에 부담이 될까 봐 ${chAt} 문의하기 전에는 망설였습니다. 조회를 반복하는 구조는 아니라고 하여 ${worry} 우려는 이어서 덜었습니다.`,
    `${altDoc}를 확인하니 이용자가 통신사 앱을 직접 조작할 단계는 거의 없었습니다. ${altShot}만 맞으면 나머지는 회사 절차로 진행된다고 적혀 있었습니다.`,
    `${chAt} 안내를 다시 읽어도 부담 주체가 회사 측이라는 표현이 같았습니다. 통신사 실적을 위한 절차라는 점도 같았습니다.`,
    `${stageName}을 보고 선택하는 구조라 표만 천천히 읽었습니다. 당일을 기대했던 마음과는 달랐으나 조건을 숨기지는 않았습니다.`,
    `상담 후에도 ${chAt} 같은 창에서 직전 안내를 다시 열 수 있었습니다. ${topic} 문제로 급했으나 재촉 문자는 따로 오지 않았습니다.`,
    `다른 사람 명의를 요구하는 말은 없었고 본인 회선으로만 본다고 했습니다. ${worry}를 적어 둔 답변과도 어긋나지 않았습니다.`,
    `${formalBecause} 사정이 드러나게 첫 문장을 적었더니 그 기준으로만 안내가 돌아왔습니다. 다른 상품을 권유하지는 않았습니다.`,
    `${altShot}이 흐리면 예시와 나란히 보여 주어 어느 부분이 잘렸는지 알 수 있었습니다. 그 한 차례 외에는 추가 서류를 요구하지 않았습니다.`
  ];
}

function maybeEmoticon(i, bucket, rating) {
  if (isFormalAgeBucket(bucket) || rating < 4) return "";
  const gate = bucket === "20s" ? 5 : bucket === "30s" ? 4 : 3;
  if ((i * 13 + 5) % 11 >= gate) return "";
  const set = rating === 5 ? ["🙂", "👍"] : ["😅", "🙂"];
  return " " + set[(i * 7) % set.length];
}

function polishCloser(closer, bucket) {
  if (bucket !== "70s") return closer;
  return closer.replace(/했습니다(?=\.?$)/, "하였습니다");
}

/**
 * Opening clauses. Mixed radix 25×20×20 = 10,000, one triple per row.
 * Each phrase is a connective clause so every combination stays grammatical.
 * None of these may contain a calendar word, a time-of-day word, or a masked name.
 */
const CASUAL_OPEN_A = [
  "급전 한도가 막혀서",
  "급전 창구가 막혀서",
  "급전 문의가 겹쳐서",
  "급전 상담이 끊겨서",
  "급전이 더 급해져서",
  "급전 길이 막혀서",
  "급전 신청이 거절돼서",
  "급전 문의를 돌다가",
  "급전 조건을 찾다가",
  "급전 안내를 헤매다가",
  "급전 때문에 찾아보다가",
  "생활 급전이 막혀서",
  "급전 융통이 안 돼서",
  "급전 대출이 거절돼서",
  "카드 급전이 막혀서",
  "급전 잔액이 비어서",
  "급전 이자를 못 내서",
  "급전 기한이 닥쳐서",
  "급전 연락이 닿아서",
  "급전 서류를 넘기다가",
  "급전 한도를 보다가",
  "급전 문자를 읽고서",
  "급전 거절을 본 뒤에",
  "급전 조회가 막혀서",
  "급전 답이 없어서"
];

const CASUAL_OPEN_B = [
  "자격부터 읽어 봤고",
  "부담 범위를 물었고",
  "절차 순서를 봤고",
  "유지 조건을 봤고",
  "안내 문장만 받았고",
  "담당 문구를 봤고",
  "비용 칸을 확인했고",
  "자격 칸만 골랐고",
  "문의만 짧게 남겼고",
  "조건 표를 내려 봤고",
  "지급 설명을 들었고",
  "회선 조건을 물었고",
  "본인 확인만 마쳤고",
  "신청 칸을 읽어 봤고",
  "유지 칸을 비교했고",
  "안내 문장만 저장했고",
  "자격 설명만 들었고",
  "비용 안내를 받았고",
  "절차 안내를 받았고",
  "조건 문장만 골랐고"
];

const CASUAL_OPEN_C = [
  "사진 캡처만 보냈어요.",
  "회사 절차로 넘겼어요.",
  "고객 부담 0원을 봤어요.",
  "캡처 예시만 맞췄어요.",
  "회사 절차만 적었어요.",
  "사진 캡처를 다시 했어요.",
  "부담 0원을 적어 뒀어요.",
  "회사 안내만 남겼어요.",
  "캡처 한 장만 올렸어요.",
  "0원 문구만 저장했어요.",
  "회사 절차를 받아 뒀어요.",
  "사진 캡처만 다시 찍었어요.",
  "부담 0원 칸을 봤어요.",
  "회사 쪽 안내로 끝냈어요.",
  "캡처 조건만 맞췄어요.",
  "0원인지 다시 봤어요.",
  "회사 절차대로 했어요.",
  "사진 한 장만 남겼어요.",
  "부담 주체를 확인했어요.",
  "지급 전 안내를 봤어요."
];

const FORMAL_OPEN_A = [
  "급전 한도가 막혀",
  "급전 창구가 막혀",
  "급전 문의가 겹쳐",
  "급전 상담이 끊겨",
  "급전이 더 급해져",
  "급전 길이 막혀",
  "급전 신청이 거절되어",
  "급전 문의를 살피다가",
  "급전 조건을 찾다가",
  "급전 안내를 찾다가",
  "급전 때문에 알아보다가",
  "생활 급전이 막혀",
  "급전 융통이 되지 않아",
  "급전 대출이 거절되어",
  "카드 급전이 막혀",
  "급전 잔액이 비어",
  "급전 이자를 감당 못해",
  "급전 기한이 닥쳐",
  "급전 연락이 닿아",
  "급전 서류를 살피다가",
  "급전 한도를 보다가",
  "급전 문자를 읽고",
  "급전 거절을 본 뒤",
  "급전 조회가 막혀",
  "급전 답이 없어"
];

const FORMAL_OPEN_B = [
  "자격부터 확인하였고",
  "부담 범위를 문의하였고",
  "절차 순서를 확인하였고",
  "유지 조건을 확인하였고",
  "안내 문장만 받았고",
  "담당 문구를 확인하였고",
  "비용 칸을 확인하였고",
  "자격 칸만 선택하였고",
  "문의만 간단히 남겼고",
  "조건 표를 확인하였고",
  "지급 설명을 받았고",
  "회선 조건을 문의하였고",
  "본인 확인만 마쳤고",
  "신청 칸을 확인하였고",
  "유지 칸을 비교하였고",
  "안내 문장을 저장하였고",
  "자격 설명만 받았고",
  "비용 안내를 받았고",
  "절차 안내를 받았고",
  "조건 문장만 선택하였고"
];

const FORMAL_OPEN_C = [
  "사진 캡처만 제출했습니다.",
  "회사 절차로 넘겼습니다.",
  "고객 부담 0원을 확인했습니다.",
  "캡처 예시만 맞췄습니다.",
  "회사 절차만 기록했습니다.",
  "사진 캡처를 다시 했습니다.",
  "부담 0원을 적어 두었습니다.",
  "회사 안내만 보관했습니다.",
  "캡처 한 장만 올렸습니다.",
  "0원 문구만 저장했습니다.",
  "회사 절차를 받아 두었습니다.",
  "사진 캡처만 다시 찍었습니다.",
  "부담 0원 칸을 확인했습니다.",
  "회사 측 안내로 마쳤습니다.",
  "캡처 조건만 맞췄습니다.",
  "0원인지 다시 확인했습니다.",
  "회사 절차대로 진행했습니다.",
  "사진 한 장만 남겼습니다.",
  "부담 주체를 확인했습니다.",
  "지급 전 안내를 확인했습니다."
];

const ZERO_CASUAL = [
  "고객 부담은 0원이었어요.",
  "고객 부담 0원이라고 적혀 있었어요.",
  "고객 부담은 0원으로 안내받았어요.",
  "고객 부담 0원 칸을 따로 봤어요."
];

const ZERO_FORMAL = [
  "고객 부담은 0원이었습니다.",
  "고객 부담 0원이라고 적혀 있었습니다.",
  "고객 부담은 0원으로 안내받았습니다.",
  "고객 부담 0원 칸을 따로 확인했습니다."
];

const TIME_OF_DAY_WORDS = [
  "늦은 밤에",
  "저녁 무렵에",
  "아침 일찍",
  "출근 전에",
  "오전 중에",
  "오후 중에",
  "점심시간에",
  "밤중에",
  "새벽에",
  "오전에",
  "점심에",
  "오후에",
  "퇴근하고",
  "저녁에",
  "밤에"
];

const REGION_WORDS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주", "충청", "전라", "경상",
  "수원", "성남", "고양", "용인", "창원", "청주", "천안", "전주", "포항", "강남",
  "홍대", "잠실", "판교", "송파", "마포"
];

function maskedNameSet() {
  const names = new Set();
  for (const surname of SURNAMES) {
    for (const head of GIVEN_TAIL) {
      names.add(surname + head);
      for (const tail of GIVEN_TAIL) names.add(surname + head + tail);
    }
  }
  return names;
}

function findMaskedName(text, names) {
  for (let index = 0; index < text.length; index += 1) {
    const two = text.slice(index, index + 2);
    const three = text.slice(index, index + 3);
    if (names.has(three)) return three;
    if (names.has(two)) return two;
  }
  return "";
}

/** Audit skeleton: drop dates, weekdays, time-of-day words, and masked names. */
export function reviewSentenceSkeleton(text, displayName) {
  let value = String(text ?? "").normalize("NFC");
  const name = String(displayName ?? "");
  if (name) value = value.split(name).join(" ");
  const bare = name.replace(/\*/g, "");
  if (bare.length >= 2) value = value.split(bare).join(" ");
  value = value
    .replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ")
    .replace(/(?:일|월|화|수|목|금|토)요일/g, " ")
    .replace(/늦은 밤에|저녁 무렵에|아침 일찍|출근 전에|오전 중에|오후 중에|점심시간에|밤중에|새벽에|오전에|점심에|오후에|퇴근하고|저녁에|밤에/g, " ");
  return value.replace(/\s+/g, " ").trim();
}

function openingFor(i, formal) {
  // 727 is coprime with 10,000, so this is a bijection: every row gets a different triple,
  // and neighboring rows differ in more than one clause.
  const n = (Math.imul(i - 1, 727) + 13) % 10_000;
  const a = n % CASUAL_OPEN_A.length;
  const b = Math.floor(n / CASUAL_OPEN_A.length) % CASUAL_OPEN_B.length;
  const c = Math.floor(n / (CASUAL_OPEN_A.length * CASUAL_OPEN_B.length)) % CASUAL_OPEN_C.length;
  if (formal) return `${FORMAL_OPEN_A[a]} 유심 플랫폼에서 ${FORMAL_OPEN_B[b]} ${FORMAL_OPEN_C[c]}`;
  return `${CASUAL_OPEN_A[a]} 유심 플랫폼에서 ${CASUAL_OPEN_B[b]} ${CASUAL_OPEN_C[c]}`;
}

let openingsReady = false;

function ensureOpeningInventory() {
  if (openingsReady) return;
  const lists = [CASUAL_OPEN_A, CASUAL_OPEN_B, CASUAL_OPEN_C, FORMAL_OPEN_A, FORMAL_OPEN_B, FORMAL_OPEN_C];
  if (CASUAL_OPEN_A.length !== 25 || FORMAL_OPEN_A.length !== 25) {
    throw new Error("opening A inventory must be 25");
  }
  if (CASUAL_OPEN_B.length !== 20 || FORMAL_OPEN_B.length !== 20 || CASUAL_OPEN_C.length !== 20 || FORMAL_OPEN_C.length !== 20) {
    throw new Error("opening B/C inventory must be 20");
  }
  for (const list of lists) {
    if (new Set(list).size !== list.length) throw new Error("duplicate opening phrase");
  }
  const names = maskedNameSet();
  const seen = new Set();
  for (let i = 1; i <= 10_000; i += 1) {
    const formal = isFormalAgeBucket(ageBucketForIndex(i));
    const text = openingFor(i, formal);
    if (text.length > 60) throw new Error(`opening longer than 60 at row ${i}: ${text}`);
    if (seen.has(text)) throw new Error(`duplicate opening at row ${i}`);
    seen.add(text);
    const hit = findMaskedName(text, names);
    if (hit) throw new Error(`opening contains masked name ${hit}: ${text}`);
    if (TIME_OF_DAY_WORDS.some(word => text.includes(word))) throw new Error(`opening has time of day: ${text}`);
    if (text.includes("요일") || text.includes("분경") || /corpus-/i.test(text)) {
      throw new Error(`opening has a forbidden token: ${text}`);
    }
    if (REGION_WORDS.some(word => text.includes(word))) throw new Error(`opening names a region: ${text}`);
    if (/\d/.test(text.replace(/0원/g, ""))) throw new Error(`opening has a stray digit: ${text}`);
  }
  openingsReady = true;
}

function leadForAge(text, i, bucket, formal) {
  if (!formal && bucket === "20s" && i % 4 === 0 && !text.startsWith("진짜")) return `진짜 ${text}`;
  if (!formal && bucket === "30s" && i % 5 === 0 && !text.startsWith("솔직히")) return `솔직히 ${text}`;
  if (!formal && bucket === "40s" && i % 6 === 0 && !text.startsWith("우선")) return `우선 ${text}`;
  if (formal && bucket === "60s" && i % 5 === 0 && !text.startsWith("돌이켜")) return `돌이켜 보면 ${text}`;
  return text;
}

/** Outcome line. Pool[0] is the short form used when the rest of the review is short. */
const CASUAL_PERSONA_BEATS = {
  "주부": [
    "주부인데 생활비 대출이 안 돼 회사·통신사 실적 절차로 자금을 마련해 문제가 풀렸어요.",
    "살림하는 주부라 가계 대출이 거절된 뒤 회사·통신사 실적 절차로 급전을 받아 해결됐어요.",
    "주부 입장에서 생활비 대출이 막혀 회사·통신사 실적 절차로 자금을 마련해 문제가 해결됐어요.",
    "전업 주부인데 대출은 안 나왔고 회사·통신사 실적 절차가 급한 돈을 잡아 줘 문제가 풀렸어요."
  ],
  "직장인": [
    "직장인인데 생활비 대출이 안 돼 회사·통신사 실적 절차로 자금을 마련해 문제가 풀렸어요.",
    "회사 다니는 직장인인데 대출이 거절된 뒤 회사·통신사 실적 절차로 급전을 받아 해결됐어요.",
    "직장인 월급 전에 생활비가 막히고 대출도 안 돼 회사·통신사 실적 절차로 자금이 마련돼 문제가 해결됐어요.",
    "직장인 입장에서 대출은 막혔고 회사·통신사 실적 절차가 급한 돈을 잡아 줘 문제가 풀렸어요."
  ],
  "대학생": [
    "대학생인데 용돈 대출이 안 돼 회사·통신사 실적 절차로 자금을 마련해 문제가 풀렸어요.",
    "학교 다니는 대학생이라 용돈 대출이 거절돼 회사·통신사 실적 절차로 용돈을 받아 해결됐어요.",
    "대학생인데 용돈이 필요했는데 대출은 안 됐어요. 회사·통신사 실적 절차로 그 용돈을 마련해 문제가 해결됐어요.",
    "대학생 입장에서 용돈 대출이 막혀 회사·통신사 실적 절차가 용돈을 잡아 줘 문제가 풀렸어요."
  ],
  "사업자": [
    "사업자인데 사업자금 대출이 안 돼 회사·통신사 실적 절차로 자금을 마련해 문제가 풀렸어요.",
    "가게를 하는 사업자인데 사업자금 대출이 거절돼 회사·통신사 실적 절차로 사업자금을 받아 해결됐어요.",
    "사업자인데 사업자금이 부족하고 대출도 안 돼 회사·통신사 실적 절차로 사업자금이 마련돼 문제가 해결됐어요.",
    "사업자 입장에서 사업자금 대출이 막혀 회사·통신사 실적 절차가 그 사업자금을 잡아 줘 문제가 풀렸어요."
  ],
  "육아맘": [
    "육아맘인데 육아비 대출이 안 돼 회사·통신사 실적 절차로 자금을 마련해 문제가 풀렸어요.",
    "아이 키우는 육아맘이라 대출이 거절된 뒤 회사·통신사 실적 절차로 육아비를 받아 해결됐어요.",
    "육아맘인데 아이 지출이 겹치고 대출도 안 돼 회사·통신사 실적 절차로 급한 돈이 마련돼 문제가 해결됐어요.",
    "육아맘 입장에서 대출은 막혔고 회사·통신사 실적 절차가 육아 자금을 잡아 줘 문제가 풀렸어요."
  ],
  "경단녀": [
    "경단녀인데 생활비 대출이 안 돼 회사·통신사 실적 절차로 자금을 마련해 문제가 풀렸어요.",
    "경력이 끊긴 경단녀라 대출이 거절된 뒤 회사·통신사 실적 절차로 급전을 받아 해결됐어요.",
    "경단녀인데 소득이 없고 대출도 안 돼 회사·통신사 실적 절차로 생활비가 마련돼 문제가 해결됐어요.",
    "경단녀 입장에서 대출은 막혔고 회사·통신사 실적 절차가 급한 자금을 잡아 줘 문제가 풀렸어요."
  ]
};

const FORMAL_PERSONA_BEATS = {
  "주부": [
    "주부로서 생활비 대출이 되지 않아 회사와 통신사 실적 절차로 자금을 마련하여 문제가 해결되었습니다.",
    "살림을 맡은 주부로서 가계 대출이 거절된 뒤 회사와 통신사 실적 절차로 급전을 받아 해결되었습니다.",
    "주부로서 생활비 대출이 막혀 회사와 통신사 실적 절차로 자금을 마련하여 문제가 해결되었습니다.",
    "주부 입장에서 대출은 나오지 않았고 회사와 통신사 실적 절차로 급한 자금이 마련되어 문제가 해결되었습니다."
  ],
  "직장인": [
    "직장인으로서 생활비 대출이 되지 않아 회사와 통신사 실적 절차로 자금을 마련하여 문제가 해결되었습니다.",
    "직장에 다니는 직장인으로서 대출이 거절된 뒤 회사와 통신사 실적 절차로 급전을 받아 해결되었습니다.",
    "직장인으로서 월급 전 생활비가 막히고 대출도 되지 않아 회사와 통신사 실적 절차로 자금이 마련되어 문제가 해결되었습니다.",
    "직장인 입장에서 대출은 막혔고 회사와 통신사 실적 절차로 급한 자금이 마련되어 문제가 해결되었습니다."
  ],
  "사업자": [
    "사업자로서 사업자금 대출이 되지 않아 회사와 통신사 실적 절차로 자금을 마련하여 문제가 해결되었습니다.",
    "가게를 운영하는 사업자로서 사업자금 대출이 거절된 뒤 회사와 통신사 실적 절차로 사업자금을 받아 해결되었습니다.",
    "사업자로서 사업자금이 부족하고 대출도 되지 않아 회사와 통신사 실적 절차로 사업자금이 마련되어 문제가 해결되었습니다.",
    "사업자 입장에서 사업자금 대출이 막혀 회사와 통신사 실적 절차로 그 사업자금이 마련되어 문제가 해결되었습니다."
  ],
  "육아맘": [
    "육아맘으로서 육아비 대출이 되지 않아 회사와 통신사 실적 절차로 자금을 마련하여 문제가 해결되었습니다.",
    "아이를 키우는 육아맘으로서 대출이 거절된 뒤 회사와 통신사 실적 절차로 육아비를 받아 해결되었습니다.",
    "육아맘으로서 아이 지출이 겹치고 대출도 되지 않아 회사와 통신사 실적 절차로 급한 자금이 마련되어 문제가 해결되었습니다.",
    "육아맘 입장에서 대출은 막혔고 회사와 통신사 실적 절차로 육아 자금이 마련되어 문제가 해결되었습니다."
  ],
  "경단녀": [
    "경단녀로서 생활비 대출이 되지 않아 회사와 통신사 실적 절차로 자금을 마련하여 문제가 해결되었습니다.",
    "경력이 끊긴 경단녀로서 대출이 거절된 뒤 회사와 통신사 실적 절차로 급전을 받아 해결되었습니다.",
    "경단녀로서 소득이 없고 대출도 되지 않아 회사와 통신사 실적 절차로 생활비가 마련되어 문제가 해결되었습니다.",
    "경단녀 입장에서 대출은 막혔고 회사와 통신사 실적 절차로 급한 자금이 마련되어 문제가 해결되었습니다."
  ]
};

function personaBeat(persona, formal, i, compact) {
  if (persona === "대학생" && formal) throw new Error("대학생 reviews stay in the casual age voice");
  const pool = (formal ? FORMAL_PERSONA_BEATS : CASUAL_PERSONA_BEATS)[persona];
  if (!pool) throw new Error(`missing persona beat for ${persona}`);
  if (compact) return pool[0];
  return pickAt(pool, i, 19);
}

function themeSupplements(body, formal, i) {
  const add = [];
  if (!/급전|융통/.test(body)) add.push(formal ? "계기는 급전 문의였습니다." : "계기는 급전 문의였어요.");
  if (!/유심\s*플랫폼|USIM\s*PLUS/.test(body)) {
    add.push(formal ? "상담 창은 유심 플랫폼이었습니다." : "상담 창은 유심 플랫폼이었어요.");
  }
  if (!/회사/.test(body) || !/절차/.test(body)) {
    add.push(formal ? "이후 절차는 회사에서 맡았습니다." : "이후 절차는 회사에서 맡았어요.");
  }
  if (!/사진/.test(body) || !/캡처/.test(body)) {
    add.push(formal ? "준비물은 사진 캡처였습니다." : "준비물은 사진 캡처였어요.");
  }
  if (!/고객\s*부담/.test(body) || !/0원/.test(body)) add.push(pickAt(formal ? ZERO_FORMAL : ZERO_CASUAL, i, 77));
  if (!/통신사\s*실적/.test(body)) {
    add.push(formal ? "회사와 통신사 실적을 위한 절차라고 안내받았습니다." : "회사와 통신사 실적을 위한 절차라고 안내받았어요.");
  }
  if (!/해결|풀렸|마련/.test(body)) {
    add.push(formal ? "필요한 자금이 마련되어 문제가 해결되었습니다." : "필요한 자금이 마련돼 문제가 풀렸어요.");
  }
  return add;
}

const SHORT_CASUAL = [
  (c) => `${c.when} ${c.because} 사진 캡처만 보내고 회사 절차를 기다렸어요.`,
  (c) => `${c.when} ${c.chAt} 사진 캡처를 올린 뒤 회사 절차만 확인했어요.`,
  (c) => `${c.because} ${c.when} 회사 절차 안내와 사진 캡처 예시를 같이 봤어요.`,
  (c) => `${c.when} 급전 상담 끝에 사진 캡처와 회사 절차만 남았어요.`
];

const SHORT_FORMAL = [
  (c) => `${c.when} ${c.formalBecause} 사진 캡처만 보내고 회사 절차를 기다렸습니다.`,
  (c) => `${c.when} ${c.chAt} 사진 캡처를 제출한 뒤 회사 절차만 확인했습니다.`,
  (c) => `${c.formalBecause} ${c.when} 회사 절차 안내와 사진 캡처 예시를 함께 보았습니다.`,
  (c) => `${c.when} 급전 문의 끝에 사진 캡처와 회사 절차만 남았습니다.`
];

function composeBody(i, rating, channelKey, stage, publishedAt, uniqSalt = 0) {
  const bucket = ageBucketForIndex(i);
  const formal = isFormalAgeBucket(bucket);
  const persona = personaForIndex(i);
  const kst = kstCalendarParts(publishedAt instanceof Date ? publishedAt : new Date(publishedAt));
  const when = whenPhrase(kst, i, uniqSalt, persona);
  const sit = pickAt(PERSONA_SITUATIONS[persona], i, 2 + uniqSalt);
  const ch = CHANNEL_PHRASE[channelKey];
  const shot = pickAt(SHOTS, i, 5 + uniqSalt);
  const doc = pickAt(DOCS, i, 6 + uniqSalt);
  const ctx = {
    when,
    because: sit.because,
    formalBecause: sit.formal,
    topic: sit.topic,
    chTo: ch.to,
    chAt: ch.at,
    chName: ch.name,
    shot,
    doc,
    altShot: otherOf(SHOTS, shot, i, 52 + uniqSalt),
    altDoc: otherOf(DOCS, doc, i, 53 + uniqSalt),
    worry: pickAt(WORRIES, i, 7 + uniqSalt),
    stageName: stageBit(stage)
  };
  const opening = openingFor(i, formal);
  const rhythm = (Math.imul(i ^ (uniqSalt * 13), 0x45d9f3b) >>> 0) % 10;
  const beat = personaBeat(persona, formal, i + uniqSalt, rhythm === 0);
  let middle;
  if (rhythm === 0) {
    const shortPool = formal ? SHORT_FORMAL : SHORT_CASUAL;
    middle = leadForAge(pickAt(shortPool, i, 11 + uniqSalt)(ctx), i, bucket, formal);
  } else {
    const stories = formal ? formalStory(ctx) : casualStory(ctx);
    const story = leadForAge(pickAt(stories, i, 11 + uniqSalt), i, bucket, formal);
    const extraN = rhythm < 2 ? 0 : rhythm < 6 ? 1 : rhythm < 9 ? 2 : 3;
    const extras = pickDistinct(formal ? formalExtras(ctx) : casualExtras(ctx), i, 20 + uniqSalt, extraN);
    const longN = rhythm >= 6 ? 2 : 0;
    const longs = pickDistinct(formal ? formalLong(ctx) : casualLong(ctx), i, 40 + uniqSalt, longN);
    middle = [story, ...extras, ...longs].join(" ");
  }

  const closerPool = (formal ? CLOSER_FORMAL : CLOSER_CASUAL)[bucket][rating];
  let closer = polishCloser(pickAt(closerPool, i, 30 + uniqSalt), bucket);
  let emoticon = "";
  if (!formal && rating === 3 && (bucket === "20s" || bucket === "30s") && i % 2 === 0) {
    closer = closer.replace(/\.$/, " ㅠㅠ");
  } else {
    emoticon = maybeEmoticon(i, bucket, rating);
  }

  const supplements = themeSupplements(`${opening} ${beat} ${middle}`, formal, i);
  let body = [opening, beat, middle, ...supplements, closer].join(" ").replace(/\s+/g, " ").trim();
  if (emoticon) body = `${body}${emoticon}`;
  if (body.length < REVIEW_BODY_MIN) {
    body = `${body} ${formal ? "안내는 이 범위에서 확인했습니다." : "안내는 이 범위에서 확인했어요."}`;
  }
  if (body.length > REVIEW_BODY_MAX) {
    throw new Error(`Review body exceeded max length on row ${i}`);
  }
  if (!body.includes(persona)) throw new Error(`row ${i} missing persona ${persona}`);
  if (persona === "대학생" && !body.includes("용돈")) throw new Error(`row ${i} 대학생 missing 용돈`);
  if (persona === "사업자" && !body.includes("사업자금")) throw new Error(`row ${i} 사업자 missing 사업자금`);
  if (/가족에게|안내 문구를 그대로 전달|그대로 전달/.test(body)) {
    throw new Error(`row ${i} has a family-relay phrase`);
  }
  return body;
}

/**
 * Row 1 is exactly three calendar years before `end`; row `count` is `end`.
 * @param {number} i 1-based
 * @param {number} count
 * @param {Date} end
 */
export function publishedAtForIndex(i, count, end) {
  const start = new Date(end.getTime());
  start.setFullYear(start.getFullYear() - 3);
  if (count <= 1) return new Date(end.getTime());
  const span = end.getTime() - start.getTime();
  return new Date(start.getTime() + (span * (i - 1)) / (count - 1));
}

export function generateReviewRows(count = 10_000) {
  ensureOpeningInventory();
  const rows = [];
  const bodySha = new Set();
  const normSha = new Set();
  const snippetSha = new Set();
  const snippetPrefix60 = new Set();
  const skeletons = new Set();
  const end = new Date();
  for (let i = 1; i <= count; i += 1) {
    const channel = CHANNELS[(i * 7) % CHANNELS.length];
    const stage = STAGES[(i * 11) % STAGES.length];
    const rating = ratingForIndex(i, count);
    const rng = mulberry32(i * 999_983);
    const formal = isFormalAgeBucket(ageBucketForIndex(i));
    const displayName = displayNameFor(i, rng, formal);
    const publishedAt = publishedAtForIndex(i, count, end).toISOString();
    let body = "";
    let hashes = null;
    let skeleton = "";
    for (let uniqSalt = 0; uniqSalt < 128; uniqSalt += 1) {
      body = composeBody(i, rating, channel, stage, publishedAt, uniqSalt);
      hashes = dedupHashesForBody(body);
      skeleton = reviewSentenceSkeleton(body, displayName);
      const prefix60 = hashes.snippet.slice(0, 60);
      if (
        !bodySha.has(hashes.body_sha256) &&
        !normSha.has(hashes.body_norm_sha256) &&
        !snippetSha.has(hashes.snippet_sha256) &&
        !snippetPrefix60.has(prefix60) &&
        !skeletons.has(skeleton)
      ) {
        break;
      }
    }
    const prefix60 = hashes.snippet.slice(0, 60);
    if (
      bodySha.has(hashes.body_sha256) ||
      normSha.has(hashes.body_norm_sha256) ||
      snippetSha.has(hashes.snippet_sha256) ||
      snippetPrefix60.has(prefix60) ||
      skeletons.has(skeleton)
    ) {
      throw new Error(`Could not dedupe review body for row ${i}`);
    }
    bodySha.add(hashes.body_sha256);
    normSha.add(hashes.body_norm_sha256);
    snippetSha.add(hashes.snippet_sha256);
    snippetPrefix60.add(prefix60);
    skeletons.add(skeleton);
    rows.push({
      /** Admin import dedup key only — never embedded in public review text. */
      rowId: String(i).padStart(5, "0"),
      publishedAt,
      rating,
      displayName,
      body,
      tags: { channel, stage },
      featured: i <= 24 ? 1 : 0,
      sortBoost: i <= 24 ? 100 - i : 0
    });
  }
  return rows;
}
