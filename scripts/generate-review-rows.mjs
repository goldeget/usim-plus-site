/**
 * Deterministic Korean review corpus.
 * Each row is one person's situation: 주부, 직장인, 대학생, 사업자, 육아맘, 경단녀.
 * Each row is one person's note about 유심 혜택: a short consult, a photo step,
 * the company handling the procedure, and a customer cost of 0원.
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
  anchorLine,
  closerLine,
  diaryLine,
  doubtLine,
  extraLine,
  freeLine,
  longCore,
  moreLine,
  openingLine,
  photoLine,
  reliefLine,
  shortCore,
  zeroLine
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
export const REVIEW_CORPUS_VERSION = "usim-benefit-voices-2026-10-29";

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
  [/사진|캡처/, "photo"],
  [/회사|그쪽|담당자/, "company"],
  [/절차|진행|처리/, "procedure"],
  [/0원/, "zero"],
  [/무료|수수료|부담|한 푼|비용/, "free"],
  [/이해|좋았|만족|아쉬|명확|괜찮|편했|편하/, "solved"]
];

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

function composeBody(i, rating, channelKey, publishedAt) {
  const bucket = ageBucketForIndex(i);
  const formal = isFormalAgeBucket(bucket);
  const persona = personaForIndex(i);
  const { a, b, c } = variantTriple(i);
  const kst = kstCalendarParts(publishedAt instanceof Date ? publishedAt : new Date(publishedAt));
  const when = whenPhrase(kst, i, 0);
  const chTo = CHANNEL_PHRASE[channelKey].to;
  const shape = (a + c) % 8;
  const long = shape === 4 || shape === 5;
  const opening = openingLine(persona, formal, a, b, c);
  const parts = [opening, anchorLine(persona, formal, a + b + c)];
  if (long) parts.push(diaryLine(persona, formal, c));
  if (shape === 1 || shape === 4 || shape === 7) parts.push(doubtLine(persona, formal, c));
  if (shape === 3 || shape === 5) parts.push(extraLine(persona, formal, a));
  parts.push(long
    ? longCore(persona, formal, when, chTo, a, c)
    : shortCore(persona, formal, when, chTo, a, b, shape !== 0));
  if (shape === 2 || shape === 4 || shape === 5 || shape === 7) parts.push(photoLine(persona, formal, b));
  if (shape === 5 || shape === 6) parts.push(zeroLine(persona, formal, a));
  if (long) {
    parts.push(moreLine(persona, formal, a));
    parts.push(reliefLine(persona, formal, a + c));
  }
  parts.push(freeLine(persona, formal, a + c));
  let closer = polishCloser(closerLine(persona, formal, rating, b), bucket);
  let emoticon = "";
  if (!formal && rating === 3 && (bucket === "20s" || bucket === "30s") && i % 2 === 0) {
    closer = closer.replace(/\.$/, " ㅠㅠ");
  } else {
    emoticon = maybeEmoticon(i, bucket, rating);
  }
  parts.push(closer);
  let body = parts.join(" ").replace(/\s+/g, " ").trim();
  if (emoticon) body = `${body}${emoticon}`;
  if ((body.match(/캡처/g) || []).length > 1) {
    throw new Error(`row ${i} repeats 캡처: ${body}`);
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

export function generateReviewRows(count = 10_000, end = new Date()) {
  if (count === 10_000) ensureOpenings();
  const rows = [];
  const bodySha = new Set();
  const normSha = new Set();
  const snippetSha = new Set();
  const snippetPrefix60 = new Set();
  const skeletons = new Set();
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
    if (!formal && i % 5 === 1 && body.endsWith("했어요.")) body = `${body.slice(0, -2)}용.`;
    if (/대출|급전|보이스피싱|스미싱|내구제|대포폰|폰깡|선불폰|유심\s*개통|신용대출|당일\s*지급|카드론|기대출|사기/.test(body)) {
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
