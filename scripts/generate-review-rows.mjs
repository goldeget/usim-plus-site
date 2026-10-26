/**
 * Deterministic Korean review corpus for import (unique bodies, dedup-safe).
 * Used by seed scripts and tests — not shown verbatim in operator UI.
 */
import { REVIEW_BODY_MIN, REVIEW_BODY_MAX } from "../functions/_lib/reviews.js";

const CHANNEL_LABEL = {
  channeltalk: "채널톡",
  telegram: "텔레그램",
  line: "LINE"
};

const CHANNELS = ["channeltalk", "telegram", "line"];
const STAGES = ["3", "15", "30", "consult"];

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
const GIVEN_TAIL = ["민", "준", "서", "현", "우", "진", "영", "희", "수", "연", "호", "윤", "아", "성", "경", "혜", "택", "빈", "람", "솔"];

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const REASONS = [
  "번호 이동", "신규 개통", "기존 회선 유지", "데이터 사용량", "통신비 부담", "가족 회선", "직장용 보조 회선",
  "여행 전 준비", "해외 출장 전", "자녀 회선", "부모님 회선", "2nd 디바이스", "태블릿용 유심", "임시 회선"
];
const TIMES = ["출근 전", "점심시간", "퇴근 후", "주말 오전", "주말 저녁", "늦은 밤", "새벽", "오후"];

const OPENERS = [
  "처음엔 반신반의했는데",
  "지인 추천으로 알게 됐고",
  "검색하다가 찾았는데",
  "블로그 후기 보고 연락했고",
  "카페 글 보고 문의했는데",
  "회사 동료가 소개해 줘서",
  "전에 쓰던 업체가 말아먹어서 다시 알아보다",
  "급하게 필요해서 하루 만에 진행했는데",
  "여유 있게 조건 비교하다가",
  "사진 보내는 게 부담스러워서 망설이다가"
];

const PROCESS = [
  "조회 캡처 보내는 방법이 단순해서 따라 하기 편했습니다.",
  "상담원이 대출이 아니라는 점을 먼저 짚어 줘서 안심하고 들었습니다.",
  "유지 기간별 지급 안내를 표로 정리해 주셔서 헷갈리지 않았습니다.",
  "개통·통신 비용 부담 범위를 대화로 다시 확인할 수 있었습니다.",
  "조회 사이트 이동부터 상담까지 흐름이 끊기지 않았습니다.",
  "답장이 늦지 않아 진행 단계를 알 수 있었습니다.",
  "같은 상담창에서 다음 안내를 받아 저장해 두기 좋았습니다.",
  "조건 설명이 길지 않아 핵심만 빠르게 이해했습니다.",
  "사진 재촬영 요청이 와도 이유를 설명해 줘서 납득했습니다.",
  "유지 조건 충족 여부를 단계별로 짚어 주었습니다.",
  "서면·대화로 비용 부담 범위를 다시 확인했습니다.",
  "절차가 복잡해 보였지만 순서대로 하면 됐습니다."
];

const EXPERIENCE = [
  "급하게 필요했지만 조건을 먼저 본 뒤 참여했습니다.",
  "당일 지급은 아니라는 점은 미리 알고 시작했습니다.",
  "본인 명의 회선 책임은 본인에게 있다는 설명도 들었습니다.",
  "궁금한 점을 다시 물어도 친절히 답변해 주었습니다.",
  "조건에 맞춰 진행 중이며 안내는 계속 받고 있습니다.",
  "중간에 일정이 밀려도 상담 일정을 조율해 줬습니다.",
  "가족에게 설명할 때도 안내 문구를 그대로 전달하기 쉬웠습니다.",
  "처음 상담과 마무리 안내 톤이 달라 헷갈리지 않았습니다.",
  "비용이 추가로 나올 구간을 미리 짚어 줘서 예산 짜기 수월했습니다.",
  "유지 기간 계산 기준을 예시로 들어 설명해 줬습니다."
];

const LOW_RATING = [
  "안내는 받았지만 제 상황과 맞지 않아 보류 중입니다.",
  "진행 속도가 기대보다 느려 답답한 구간이 있었습니다.",
  "조건 설명을 두 번 읽어야 이해가 됐습니다.",
  "사진 요청이 많아 번거로웠던 편입니다.",
  "유지 기간 계산이 헷갈려 다시 문의했습니다."
];

const HIGH_RATING = [
  "전체적으로 차분하게 안내받아 마음이 놓였습니다.",
  "궁금했던 부분을 짧게 정리해 줘서 좋았습니다.",
  "다음 단계가 언제인지 미리 알려 줘서 일정 맞추기 편했습니다.",
  "처음 상담 때 들은 내용과 나중 안내가 크게 달라지지 않았습니다.",
  "주변에도 조건 먼저 보라고 말해 줄 정도로 정리가 잘 됐습니다."
];

const FILLERS = [
  "개인적으로는 설명 톤이 딱딱하지 않아서 좋았어요.",
  "저는 질문을 여러 번 했는데도 성의 있게 답해 주셨습니다.",
  "회선 상태에 따라 안내가 달라질 수 있다는 말도 들었습니다.",
  "조회 결과 캡처 화면 예시를 보내 줘서 헷갈리지 않았습니다.",
  "상담 링크를 즐겨찾기해 두고 필요할 때 다시 열었습니다.",
  "유심 관련 용어를 풀어서 설명해 줘서 이해가 빨랐습니다.",
  "진행 중에도 조건 변경 가능 여부를 물어봤는데 답이 명확했습니다.",
  "가입 전후로 받은 안내 문구를 메모장에 남겨 두었습니다."
];

/** @param {number} seed */
function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
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

function displayNameFor(i, rng) {
  const surname = SURNAMES[(i * 3 + 7) % SURNAMES.length];
  const tail = GIVEN_TAIL[(i * 11 + 5) % GIVEN_TAIL.length];
  if (rng() < 0.35) return `${surname}*${tail}`;
  const head = GIVEN_TAIL[(i * 17) % GIVEN_TAIL.length];
  return `${surname}${head}*`;
}

/** Bijective timeline tuple for idx 0..9999 (feeds unique opening lines). */
function timelineForIndex(i) {
  const idx = i - 1;
  const day = (idx % 28) + 1;
  const monthIdx = Math.floor(idx / 28) % MONTHS.length;
  const reasonIdx = Math.floor(idx / (28 * MONTHS.length)) % REASONS.length;
  const timeIdx = Math.floor(idx / (28 * MONTHS.length * REASONS.length)) % TIMES.length;
  const variant =
    Math.floor(idx / (28 * MONTHS.length * REASONS.length * TIMES.length)) % 4;
  return {
    month: MONTHS[monthIdx],
    day,
    reason: REASONS[reasonIdx],
    time: TIMES[timeIdx],
    variant
  };
}

function leadSentence(i, channelKey) {
  const channel = CHANNEL_LABEL[channelKey] || channelKey;
  const t = timelineForIndex(i);
  const variants = [
    `${t.month} ${t.day}일 ${t.time} ${t.reason} 관련으로 ${channel}에 문의했습니다.`,
    `${t.month} ${t.day}일 ${t.time}, ${t.reason} 조건을 ${channel} 상담으로 확인했습니다.`,
    `${t.time} ${channel} 상담에서 ${t.reason} 가능 여부를 ${t.month} ${t.day}일에 먼저 짚었습니다.`,
    `${t.reason} 검토하다 후기 보고 ${t.month} ${t.day}일 ${t.time} ${channel}으로 연락했습니다.`
  ];
  return variants[t.variant];
}

function composeBody(i, rating, channelKey) {
  const rng = mulberry32(i * 1_048_583 + rating * 97);
  const parts = [leadSentence(i, channelKey), pick(rng, OPENERS) + " " + pick(rng, PROCESS)];

  if (rating >= 4) parts.push(pick(rng, HIGH_RATING));
  else if (rating <= 2) parts.push(pick(rng, LOW_RATING));
  else parts.push(pick(rng, EXPERIENCE));

  parts.push(pick(rng, EXPERIENCE));

  const extraCount = (i % 5) + (rating >= 5 ? 1 : 0);
  for (let e = 0; e < extraCount; e += 1) {
    parts.push(pick(rng, FILLERS));
  }

  const t = timelineForIndex(i);
  const anchor = [
    `당시 ${pick(rng, ["LTE", "5G", "데이터 위주"])} 사용 패턴을 기준으로 안내받았고`,
    `${pick(rng, ["SKT", "KT", "LG U+"])} 조회 화면 캡처를 보냈을 때`,
    `${t.month} ${t.day}일 이후 상담을 이어 가며`,
    `${t.time} 시간대에 받은 답변 기준으로`
  ][t.variant];
  parts.push(`${anchor}, 제가 기억하는 범위에서는 안내가 일관됐습니다.`);

  let body = parts.join(" ").replace(/\s+/g, " ").trim();
  while (body.length < REVIEW_BODY_MIN) {
    body += " " + pick(rng, FILLERS);
  }
  if (body.length > REVIEW_BODY_MAX) {
    body = body.slice(0, REVIEW_BODY_MAX - 1).trim() + "…";
  }
  return body;
}

export function generateReviewRows(count = 10_000) {
  const rows = [];
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  const spanMs = end.getTime() - start.getTime();
  for (let i = 1; i <= count; i += 1) {
    const channel = CHANNELS[(i * 7) % CHANNELS.length];
    const rating = ratingForIndex(i, count);
    const rng = mulberry32(i * 999_983);
    const body = composeBody(i, rating, channel);
    const published = new Date(start.getTime() + (spanMs * i) / count);
    rows.push({
      rowId: `corpus-${String(i).padStart(5, "0")}`,
      publishedAt: published.toISOString(),
      rating,
      displayName: displayNameFor(i, rng),
      body,
      tags: {
        channel,
        stage: STAGES[(i * 11) % STAGES.length]
      },
      featured: i <= 24 ? 1 : 0,
      sortBoost: i <= 24 ? 100 - i : 0
    });
  }
  return rows;
}
