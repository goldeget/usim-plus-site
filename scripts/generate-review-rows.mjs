/**
 * Deterministic Korean review corpus.
 * Each row is one person's situation: 주부, 직장인, 대학생, 사업자, 육아맘, 경단녀.
 * Each row: the person found a USIM benefit they had not known, checked it,
 * and received the benefit they needed. Wording is not one shared sentence.
 *
 * Calendar: every 년/월/일 in a body is that row's publishedAt in Asia/Seoul.
 * Time of day follows the same instant. No "N분경" stamps.
 * After Seoul dates, weekdays, times of day, and the masked display name are
 * removed, all 10,000 sentence skeletons differ.
 *
 * Voice notes: https://m.blog.naver.com/true-water/222644750313
 * (stacked refusals, a concrete bill, then relief). Shorter rows follow the
 * same arc the way app-store reviews compress it.
 */
import { createHash } from "node:crypto";
import { reviewDateMismatch } from "../functions/_lib/review-dates.js";
import {
  REVIEW_BODY_MIN,
  REVIEW_BODY_MAX,
  makeSnippet,
  normalizeForDedup,
  normalizeReviewBody
} from "../functions/_lib/reviews.js";
import {
  FAMILY_RELAY_RE,
  PERSONA_MARKERS,
  benefitNoun,
  openingLine,
  toFormal
} from "./review-voice-packs.mjs";

export { FAMILY_RELAY_RE, PERSONA_MARKERS };

function sha256HexSync(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

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

/** Bump when corpus voice changes so seed cache files regenerate. */
export const REVIEW_CORPUS_VERSION = "usim-benefit-check-2026-10-29";

const CHANNELS = ["channeltalk", "telegram", "line"];
const STAGES = ["3", "15", "30", "consult"];

const CHANNEL_PHRASE = {
  channeltalk: { to: "채널톡으로", at: "채널톡에서", name: "채널톡" },
  telegram: { to: "텔레그램으로", at: "텔레그램에서", name: "텔레그램" },
  line: { to: "LINE으로", at: "LINE에서", name: "LINE" }
};

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
const GIVEN_TAIL = ["민", "준", "서", "현", "우", "진", "영", "희", "수", "연", "호", "윤", "아", "성", "경", "혜", "택", "빈", "람", "솔"];

const WEEKDAY_KO = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" };

const PERSONA_LANES = {
  "20s": ["대학생", "대학생", "대학생", "대학생", "대학생", "직장인", "육아맘", "주부"],
  "30s": ["직장인", "육아맘", "주부", "경단녀", "사업자", "육아맘", "직장인", "사업자"],
  "40s": ["주부", "직장인", "육아맘", "경단녀", "사업자", "경단녀", "주부", "사업자"],
  "50s": ["주부", "직장인", "사업자", "경단녀", "육아맘", "사업자", "경단녀", "주부"],
  "60s": ["주부", "사업자", "경단녀", "직장인", "육아맘", "사업자", "경단녀", "직장인"],
  "70s": ["주부", "사업자", "경단녀", "직장인", "주부", "사업자", "경단녀", "직장인"]
};

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

function todOptions(hour, weekday) {
  const weekend = weekday === "토" || weekday === "일";
  if (hour < 3) return ["밤중에", "새벽에"];
  if (hour < 6) return ["새벽에"];
  if (hour < 11) return ["오전에", "아침 일찍"];
  if (hour < 12) return ["오전에", "오전 중에"];
  if (hour < 14) return ["점심에", "점심시간에"];
  if (hour < 18) return ["오후에", "오후 중에"];
  if (hour < 22) return ["저녁에", "저녁 무렵에"];
  return ["밤에", "늦은 밤에"];
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickAt(arr, i, salt) {
  const u = Math.imul(i ^ salt, 0x9e3779b1) >>> 0;
  return arr[u % arr.length];
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

/** One life situation per row. 대학생 stays in the 20s. */
export function personaForIndex(i) {
  const lane = PERSONA_LANES[ageBucketForIndex(i)];
  const k = Math.floor((i - 1) / 6);
  return lane[k % lane.length];
}

function variantTriple(i) {
  const n = (Math.imul(i - 1, 727) + 13) % 10_000;
  return {
    a: n % 25,
    b: Math.floor(n / 25) % 20,
    c: Math.floor(n / 500) % 20
  };
}

/**
 * Corpus rating mix targeting mean exactly 4.8 on a 5-point scale (integer stars).
 * At count=10_000 with n3=100: 8100×5 + 1800×4 + 100×3 → 4.8.
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

function whenPhrase(kst, i, salt) {
  const tod = pickAt(todOptions(kst.hour, kst.weekday), i, 4 + salt);
  const md = `${kst.month}월 ${kst.day}일`;
  const ymd = `${kst.year}년 ${md}`;
  const wd = `${kst.weekday}요일`;
  return pickAt(
    [`${md} ${tod}`, `${ymd} ${tod}`, `${md} ${wd} ${tod}`, `${md} ${tod}`],
    i,
    8 + salt
  );
}

function maybeEmoticon(i, bucket, rating) {
  if (isFormalAgeBucket(bucket) || rating < 4) return "";
  const gate = bucket === "20s" ? 5 : bucket === "30s" ? 4 : 3;
  if ((i * 13 + 5) % 11 >= gate) return "";
  const set = ["🙂", "👍"];
  return " " + set[(i * 7) % set.length];
}

function polishCloser(closer, bucket) {
  if (bucket !== "70s") return closer;
  return closer.replace(/했습니다(?=\.?$)/, "하였습니다");
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

const BEATS = [
  [/유심\s*혜택/, "platform"],
  [/확인/, "checked"],
  [/받았|받음|받네|받아|필요해요/, "received"]
];

/** Short life context. Not a cash emergency. One list of 25 per persona. */
const DISCOVERY = {
  대학생: [
    "대학생이라 용돈 메모를 적다가",
    "학기 중 교재 목록을 고치다가",
    "알바 전에 학식 메뉴를 보다가",
    "자취 책상 위 레포트를 덮다가",
    "통학 카드를 정리하다가",
    "과제 인쇄를 맡기다가",
    "동아리 공지를 읽다가",
    "장학금 일정을 적다가",
    "개강 준비를 하다가",
    "실습 준비물을 챙기다가",
    "기숙사 책상을 치우다가",
    "전공 노트를 넘기다가",
    "팀플 자료를 모으다가",
    "계절학기 안내를 읽다가",
    "자격증 일정을 보다가",
    "노트북을 켜 두다가",
    "생활관 게시판을 보다가",
    "응시료 안내를 읽다가",
    "아르바이트 달력을 보다가",
    "학식 순서를 적다가",
    "대학생 노트를 덮다가",
    "용돈 기입장에 줄을 긋다가",
    "교재 목차를 쓰다가",
    "레포트 첫 줄을 쓰다가",
    "알바 교대표를 보다가"
  ],
  직장인: [
    "직장인 월급 명세를 접다가",
    "급여일을 달력에 표시하다가",
    "카드값을 표로 적다가",
    "재직 안내를 읽다가",
    "야근 수당을 적다가",
    "이직 서류를 정리하다가",
    "자동이체 목록을 보다가",
    "성과급 칸을 읽다가",
    "상여 일정을 적다가",
    "수습 안내를 읽다가",
    "잔업 기록을 덮다가",
    "연봉 계약서를 넘기다가",
    "실수령 줄을 보다가",
    "이체일 알림을 읽다가",
    "선지급 문장을 읽다가",
    "가지급 칸을 넘기다가",
    "직장 달력을 열다가",
    "급여 명세를 저장하다가",
    "명세서 파일을 닫다가",
    "수당 항목을 접다가",
    "직장인 수첩을 펼치다가",
    "카드값 알림을 읽다가",
    "월급 항목을 적다가",
    "재직 기간을 적다가",
    "야근 기록을 덮다가"
  ],
  주부: [
    "주부 장보기 목록을 고치다가",
    "살림 노트를 펼치다가",
    "반찬 재료를 적다가",
    "시장 목록을 줄이다가",
    "생필품 칸을 채우다가",
    "관리비 고지를 보다가",
    "공과금 문자를 읽다가",
    "수도요금 줄을 보다가",
    "도시가스 안내를 읽다가",
    "쌀값을 메모하다가",
    "세제 목록을 적다가",
    "김장 일정을 적다가",
    "명절 목록을 정리하다가",
    "간식 칸을 비우다가",
    "밑반찬 통을 정리하다가",
    "부식 목록을 쓰다가",
    "냉장고 메모를 붙이다가",
    "장바구니를 접다가",
    "경조사 일정을 적다가",
    "집안 서랍을 정리하다가",
    "주부 가계부를 덮다가",
    "살림 달력을 보다가",
    "장볼 순서를 바꾸다가",
    "양념 목록을 적다가",
    "생필품 이름을 적다가"
  ],
  사업자: [
    "사업자 매출 장부를 덮다가",
    "가게 계산서를 정리하다가",
    "재료비 발주를 적다가",
    "거래처 문자를 읽다가",
    "부가세 칸을 보다가",
    "임대료 일정을 적다가",
    "인건비 날짜를 표시하다가",
    "포장재를 세다가",
    "재고 숫자를 적다가",
    "배달 정산을 보다가",
    "납품 목록을 접다가",
    "전기요금 고지를 읽다가",
    "원자재 가격을 적다가",
    "운송 일지를 덮다가",
    "가게 화면을 끄다가",
    "가게 공과금을 적다가",
    "사업자 달력을 넘기다가",
    "매출 표를 접다가",
    "계산서 철을 꽂다가",
    "재고 칸을 정리하다가",
    "거래처 이름을 고치다가",
    "재료비 목록을 적다가",
    "가게 순서를 바꾸다가",
    "부가세 파일을 저장하다가",
    "인건비 표를 정리하다가"
  ],
  육아맘: [
    "육아맘이라 분유 칸을 세다가",
    "기저귀 수를 적다가",
    "보육료 문자를 읽다가",
    "어린이집 알림을 보다가",
    "이유식 재료를 적다가",
    "예방접종 일정을 적다가",
    "유모차를 접다가",
    "돌잔치 목록을 줄이다가",
    "아이 간식 칸을 채우다가",
    "아이 영수증을 모으다가",
    "돌봄 시간을 적다가",
    "아기 옷을 개키다가",
    "육아 일기를 덮다가",
    "보육 수첩을 펼치다가",
    "이유식 그릇을 챙기다가",
    "기저귀 상자를 정리하다가",
    "어린이집 준비물을 보다가",
    "예방접종 수첩을 덮다가",
    "분유 통을 정리하다가",
    "아이 신발을 맞추다가",
    "육아맘 수첩에 줄을 긋다가",
    "보육료 고지를 접다가",
    "돌봄 가방을 비우다가",
    "아기 물병을 씻다가",
    "이유식 순서를 적다가"
  ],
  경단녀: [
    "경단녀라 이력서를 덮다가",
    "재취업 글을 읽다가",
    "경력 공백을 세다가",
    "구직 앱을 닫다가",
    "일을 쉰 달을 표시하다가",
    "공백기 노트를 덮다가",
    "경단 일정을 적다가",
    "소득 공백 칸을 보다가",
    "구직 목록을 줄이다가",
    "경력 책을 덮다가",
    "재취업 교육 안내를 읽다가",
    "경력 기술서를 고치다가",
    "구직 메모를 접다가",
    "일을 놓은 기간을 적다가",
    "경단녀 수첩을 펼치다가",
    "경력 문장을 고치다가",
    "공백기 달력을 넘기다가",
    "재취업 목록을 보다가",
    "경력 칸을 읽어 보다가",
    "구직 메모를 지우다가",
    "일을 쉬며 노트를 적다가",
    "구직 질문을 적다가",
    "경단 이후 일정을 적다가",
    "소득 공백 메모를 덮다가",
    "재취업 폴더를 정리하다가"
  ]
};

const HINTS = [
  "천천히", "다시", "잠깐", "찬찬히", "끝까지", "먼저", "그냥", "이어서",
  "따로", "곧장", "나중에도", "메모하며", "비교하며", "읽어 보며", "저장하며",
  "체크하며", "찾아보며", "적어 가며", "살펴보며", "넘겨 보며"
];

const FACTS = ["5만원", "7만원", "10만원", "22만원", "66만원", "3건"];

const WAYS = [
  "필요해서", "찾아서", "읽고", "적고", "비교하고", "살피고", "메모하고", "저장하고",
  "체크하고", "넘기고", "닫고", "열고", "고치고", "정리하고", "덮고", "쓰며",
  "보며", "세며", "모으며", "줄이며", "바꾸며", "확인하며", "따라가며", "맞춰 두고", "남겨 두고"
];

const TAGS = {
  대학생: ["대학생이라", "대학생인데", "대학생은"],
  직장인: ["직장인이라", "직장인인데", "직장인은"],
  주부: ["주부라", "주부인데", "주부는"],
  사업자: ["사업자라", "사업자인데", "사업자는"],
  육아맘: ["육아맘이라", "육아맘인데", "육아맘은"],
  경단녀: ["경단녀라", "경단녀인데", "경단녀는"]
};

function missingBeats(body) {
  return BEATS.filter(([re]) => !re.test(body)).map(([, name]) => name);
}

let openingsReady = false;

function ensureOpenings() {
  if (openingsReady) return;
  const seen = new Set();
  for (let i = 1; i <= 10_000; i += 1) {
    const persona = personaForIndex(i);
    const formal = isFormalAgeBucket(ageBucketForIndex(i));
    if (persona === "대학생" && formal) throw new Error(`학생 row ${i} is formal`);
    const { a, b, c } = variantTriple(i);
    const text = openingLine(persona, formal, a, b, c);
    if (text.length > 60) throw new Error(`opening longer than 60 at row ${i} (${text.length}): ${text}`);
    if (seen.has(text)) throw new Error(`duplicate opening at row ${i}: ${text}`);
    seen.add(text);
    if (!PERSONA_MARKERS[persona].test(text)) throw new Error(`opening misses ${persona} at row ${i}: ${text}`);
    if (FAMILY_RELAY_RE.test(text)) throw new Error(`family relay in opening ${i}: ${text}`);
    if (/\d/.test(text)) throw new Error(`digit in opening ${i}: ${text}`);
  }
  if (seen.size !== 10_000) throw new Error(`expected 10000 openings, got ${seen.size}`);
  openingsReady = true;
}

function hasBatchim(word) {
  const code = String(word).charCodeAt(String(word).length - 1);
  return code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0;
}

function eul(word) {
  return hasBatchim(word) ? "을" : "를";
}

function neun(word) {
  return hasBatchim(word) ? "은" : "는";
}

function speak(text, formal, bucket) {
  let value = formal ? toFormal(text) : text;
  if (bucket === "70s") value = value.replace(/했습니다(?=\.?$)/, "하였습니다");
  return value;
}

function restyleCasualEnding(text, style) {
  if (style === 1) return text.replace(/받았어요\.$/, "받았네요.");
  if (style === 2) return text.replace(/받았어요\.$/, "받음.");
  if (style === 3) return text.replace(/받았어요\.$/, "받았어요 ㅋㅋ");
  if (style === 4) return text.replace(/받았어요\.$/, "받았어요 ㅎㅎ");
  if (style === 5) return text.replace(/받았어요\.$/, "받았어용.");
  if (style === 6) return text.replace(/받았어요\.$/, "받았고 필요해요.");
  return text;
}

function composeBody(i, rating, channelKey, publishedAt) {
  const bucket = ageBucketForIndex(i);
  const formal = isFormalAgeBucket(bucket);
  const persona = personaForIndex(i);
  const { a, b, c } = variantTriple(i);
  const hook = DISCOVERY[persona][a];
  const noun = benefitNoun(persona, b);
  const hint = HINTS[c];
  const kst = kstCalendarParts(publishedAt instanceof Date ? publishedAt : new Date(publishedAt));
  const when = whenPhrase(kst, i, 0);
  const channelName = CHANNEL_PHRASE[channelKey].name;
  const style = i % 8;
  const fact = i % 4 === 0 ? "" : FACTS[(i + b) % FACTS.length];
  const way = WAYS[a];
  const tag = TAGS[persona][b % 3];
  const spot = ["안내에서", "메모에서", "글에서", "표에서", "칸에서"][(a + c) % 5];
  const needNote = persona === "대학생" && !hook.includes("용돈") && noun !== "용돈"
    ? "용돈 옆에서 "
    : persona === "사업자"
      ? "사업자금과 별개로 "
      : "";
  const gotFact = fact ? `${fact}으로 ` : "필요한 만큼 ";
  const check = `${hook} ${hint} ${noun} ${spot} 몰랐던 유심 혜택을 확인했어요.`;
  const got = `${when} ${tag} ${needNote}${way} ${hint} ${noun} 유심 혜택을 ${gotFact}받았어요.`;
  const gripe = rating >= 5
    ? ""
    : rating === 4
      ? `${tag} ${way} ${noun} 안내가 ${hint} 조금 길었어요.`
      : `${tag} ${way} ${hint} ${noun} 답장이 늦었어요.`;
  const channelLine = i % 5 === 2
    ? `${tag} ${way} ${noun} 상담은 ${channelName}에서 ${hint} 이어졌어요.`
    : "";
  const longNote = i % 6 === 0
    ? `${tag} ${way} ${hint} ${noun} 안내를 처음부터 다시 읽었어요. 두 번째로 보니 ${tag} ${way} ${spot} 적힌 몰랐던 유심 혜택이 ${hint} 본 ${noun} 항목과 같았어요. ${channelName}에 남겨 둔 ${tag} ${way} 확인도 ${hint} ${noun} 기준이라 다시 묻지 않았어요. 저장해 둔 ${tag} ${way} ${noun} 문장도 ${hint} 안내와 같았고, 필요하던 내용이 그 안에 있었어요. ${tag} ${way} 읽어 본 ${noun} 유심 혜택은 ${hint} 확인한 내용과 같았고, ${channelName} 상담에서 다시 봐도 같은 안내였어요.`
    : "";
  const same = [
    `${tag} ${way} ${hint} 본 ${noun} 유심 혜택이 안내문과 같았어요.`,
    `${tag} ${way} ${noun}${neun(noun)} ${hint} 확인한 내용이 맞았어요.`,
    `${hint} 읽어 둔 ${tag} ${way} ${noun} 혜택이 필요하던 것과 같았어요.`,
    `${tag} ${noun} 안내를 ${way} ${hint} 보니 필요한 혜택이었어요.`,
    `${way} ${hint} ${tag} ${noun} 쪽 혜택이 안내와 맞았어요.`,
    `${tag} ${hint} ${noun}${eul(noun)} ${way} 확인하니 필요한 혜택이 적혀 있었어요.`
  ][i % 6];
  const order = i % 3;
  const parts = [];
  if (order === 0) parts.push(check, same, gripe, got, channelLine, longNote);
  else if (order === 1) parts.push(got, same, check, gripe, channelLine, longNote);
  else parts.push(check, same, channelLine, gripe, got, longNote);
  let body = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  body = speak(body, formal, bucket);
  if (!formal) body = restyleCasualEnding(body, style);
  if (!formal && rating >= 4 && i % 7 === 1 && style !== 3 && style !== 4) body = `${body} 🙂`;
  if (/잠자고\s*있던/.test(body)) throw new Error(`row ${i} reused the example phrase`);
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

export function generateReviewRows(count = 10_000, end = new Date()) {
  if (count === 10_000) ensureOpenings();
  const rows = [];
  const bodySha = new Set();
  const normSha = new Set();
  const snippetSha = new Set();
  const snippetPrefix60 = new Set();
  const skeletons = new Set();
  const seenSentences = new Set();
  for (const [persona, list] of Object.entries(DISCOVERY)) {
    if (list.length !== 25) throw new Error(`${persona} discovery list is ${list.length}`);
    for (const line of list) {
      if (!PERSONA_MARKERS[persona].test(line)) throw new Error(`${persona} discovery misses marker: ${line}`);
      if (seenSentences.has(line)) throw new Error(`duplicate discovery: ${line}`);
      seenSentences.add(line);
    }
  }
  seenSentences.clear();
  for (let i = 1; i <= count; i += 1) {
    const channel = CHANNELS[(i * 7) % CHANNELS.length];
    const stage = STAGES[(i * 11) % STAGES.length];
    const rating = ratingForIndex(i, count);
    const rng = mulberry32(i * 999_983);
    const persona = personaForIndex(i);
    const formal = isFormalAgeBucket(ageBucketForIndex(i));
    const displayName = displayNameFor(i, rng, formal);
    const publishedAt = publishedAtForIndex(i, count, end).toISOString();
    let body = composeBody(i, rating, channel, publishedAt);
    if (/대출|급전|보이스피싱|스미싱|내구제|대포폰|폰깡|선불폰|유심\s*개통|신용대출|당일\s*지급|카드론|기대출|사기|목돈|잠자고\s*있던/.test(body)) {
      throw new Error(`row ${i} risk phrase: ${body}`);
    }
    if (body.length < REVIEW_BODY_MIN || body.length > REVIEW_BODY_MAX) {
      throw new Error(`row ${i} length ${body.length}`);
    }
    const missed = missingBeats(body);
    if (missed.length) throw new Error(`row ${i} missing ${missed.join(",")}: ${body}`);
    if (!PERSONA_MARKERS[persona].test(body)) throw new Error(`row ${i} loses ${persona}`);
    if (FAMILY_RELAY_RE.test(body)) throw new Error(`row ${i} family relay: ${body}`);
    if (/\d+\s*분/.test(body) || /분경/.test(body) || /corpus-/i.test(body)) {
      throw new Error(`row ${i} forbidden stamp`);
    }
    const mismatch = reviewDateMismatch(body, publishedAt);
    if (mismatch) throw new Error(`row ${i} date ${mismatch}`);
    for (const sentence of body.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(s => s && !/^[🙂]+$/u.test(s))) {
      if (seenSentences.has(sentence)) throw new Error(`row ${i} repeats a sentence: ${sentence}`);
      seenSentences.add(sentence);
    }
    const hashes = dedupHashesForBody(body);
    const skeleton = reviewSentenceSkeleton(body, displayName);
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
      rowId: String(i).padStart(5, "0"),
      publishedAt,
      rating,
      displayName,
      body,
      tags: { channel, stage, persona },
      featured: i <= 24 ? 1 : 0,
      sortBoost: i <= 24 ? 100 - i : 0
    });
  }
  return rows;
}
