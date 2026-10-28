/**
 * Deterministic Korean review corpus.
 * Each body is one or two grammatical sentences: the person did not know
 * about the USIM benefit, checked it, and received the benefit they needed.
 * Stars, masked names, personas, and stored dates stay on the row.
 * The sentence does not repeat that stored calendar date.
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
import { bannedReviewPattern, humanReviewBody } from "./review-human-bodies.mjs";

const FAMILY_RELAY_RE = /가족|식구|부모님|남편|아내|시댁|처가에|처갓|친정/;

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
export const REVIEW_CORPUS_VERSION = "usim-benefit-sentences-2026-10-29";

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

const BEATS = [
  [/유심\s*혜택/, "platform"],
  [/확인/, "checked"],
  [/받았|받음|받네|받아|필요해요/, "received"]
];

function missingBeats(body) {
  return BEATS.filter(([re]) => !re.test(body)).map(([, name]) => name);
}

function composeBody(i) {
  const formal = isFormalAgeBucket(ageBucketForIndex(i));
  const body = humanReviewBody({ i, formal });
  if (bannedReviewPattern().test(body)) throw new Error(`row ${i} banned phrasing: ${body}`);
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
  if (count > 10_000) throw new Error(`corpus is 10000 rows, got ${count}`);
  const rows = [];
  const bodySha = new Set();
  const normSha = new Set();
  const snippetSha = new Set();
  for (let i = 1; i <= count; i += 1) {
    const channel = CHANNELS[(i * 7) % CHANNELS.length];
    const stage = STAGES[(i * 11) % STAGES.length];
    const rating = ratingForIndex(i, count);
    const rng = mulberry32(i * 999_983);
    const persona = personaForIndex(i);
    const formal = isFormalAgeBucket(ageBucketForIndex(i));
    const displayName = displayNameFor(i, rng, formal);
    const publishedAt = publishedAtForIndex(i, count, end).toISOString();
    const body = composeBody(i);
    if (/대출|급전|보이스피싱|스미싱|내구제|대포폰|폰깡|선불폰|유심\s*개통|신용대출|당일\s*지급|카드론|기대출|사기|목돈|잠자고\s*있던/.test(body)) {
      throw new Error(`row ${i} risk phrase: ${body}`);
    }
    if (body.length < REVIEW_BODY_MIN || body.length > REVIEW_BODY_MAX) {
      throw new Error(`row ${i} length ${body.length}`);
    }
    const missed = missingBeats(body);
    if (missed.length) throw new Error(`row ${i} missing ${missed.join(",")}: ${body}`);
    if (FAMILY_RELAY_RE.test(body)) throw new Error(`row ${i} family relay: ${body}`);
    if (/\d+\s*분/.test(body) || /분경/.test(body) || /corpus-/i.test(body)) {
      throw new Error(`row ${i} forbidden stamp`);
    }
    const mismatch = reviewDateMismatch(body, publishedAt);
    if (mismatch) throw new Error(`row ${i} date ${mismatch}`);
    const hashes = dedupHashesForBody(body);
    if (
      bodySha.has(hashes.body_sha256) ||
      normSha.has(hashes.body_norm_sha256) ||
      snippetSha.has(hashes.snippet_sha256)
    ) {
      throw new Error(`Could not dedupe review body for row ${i}`);
    }
    bodySha.add(hashes.body_sha256);
    normSha.add(hashes.body_norm_sha256);
    snippetSha.add(hashes.snippet_sha256);
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
