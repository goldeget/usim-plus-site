/**
 * Deterministic Korean review corpus for import (unique bodies, dedup-safe).
 * Voice: 급전·융통 필요 → 유심 플랫폼(USIM PLUS) 경로로 자격 확인 후 지원·지급;
 * 회사가 절차·통신 비용 부담, 이용자는 사진 캡처 위주 (번호이동·개통-only 후기 아님).
 * Used by seed scripts and tests — not shown verbatim in operator UI.
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
export const REVIEW_CORPUS_VERSION = "usim-zero-cost-performance-2026-10-26";

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
/** Situation hooks (급전·융통) — USIM PLUS platform path, not 번호이동·개통-only. */
const SITUATIONS = [
  "급전이 필요해 융통이 안 되던",
  "당장 돈을 돌릴 곳이 없어 급전이 필요했던",
  "은행 대출이 거절돼 생활비가 막힌",
  "카드 한도가 부족해 융통이 어려운",
  "월말 통장이 빠듯해 급전이 필요했던",
  "예상치 못한 지출에 생활비가 모자라 융통이 막힌",
  "생활비를 보태야 했던",
  "알바 수입이 줄어 급전이 필요했던",
  "자영업 매출 공백으로 융통이 막힌",
  "병원비 부담이 커 급전이 필요했던",
  "학자금 마감이 다가와 융통이 어려운",
  "전세자금이 당겨져 대출·융통이 막힌",
  "신용조회 후 대출이 어려워진",
  "유심 플랫폼 지원 경로를 처음 알게 된",
  "USIM PLUS 쪽 지급 안내를 몰랐던",
  "2금융까지 거절돼 급전이 막힌",
  "DSR 때문에 추가 대출·융통이 안 되는",
  "기대출이 많아 한도가 막힌",
  "당월 생활비를 메우기 어려운",
  "급한 병원·학비 지출이 겹쳐 융통이 필요했던",
  "신용점수는 괜찮은데 대출만 안 되는",
  "통장 잔액이 바닥나 급전 융통이 필요했던",
  "카드론 한도까지 써서 추가 자금이 막힌",
  "단기 연체 이력 때문에 대출 문이 닫힌",
  "프리랜서 소득이라 서류 대출이 어려운",
  "퇴사 후 실업급여만으로 생활비가 빠듯한",
  "가족 병원비를 한꺼번에 내야 해 융통이 급한",
  "학원비·교재비가 겹쳐 급전이 필요했던",
  "사업자 카드 결제일이 겹쳐 현금 흐름이 막힌",
  "비상금 통장을 이미 비운 뒤 급전이 필요했던"
];
const TIMES = ["출근 전", "점심시간", "퇴근 후", "주말 오전", "주말 저녁", "늦은 밤", "새벽", "오후"];

const EMOTICONS = ["🙂", "😅", "ㅠㅠ", "👍"];

/** Discovery beats (급전·융통 → USIM PLUS platform); patterns from Naver/Fin blogs. */
const DISCOVERY_CASUAL = [
  "융통이 막혀 막막했는데 유심 플랫폼 쪽 지원은 처음 들어봤어요.",
  "USIM PLUS 후기 보니 회사가 절차를 다 맡는다는 설명이 반복돼서 눈여겨봤어요.",
  "3·15·30일 유지별 지급 표를 보고 나서야 급전 지원 구조를 이해했어요.",
  "급전 알아보던 중 불법 대출이 아니라 플랫폼 지원·지급이라는 말을 듣고 톤이 달라졌어요.",
  "통신사 실적·회사 실적 때문에 참여자를 모은다는 설명도 들었어요.",
  "담당자가 사진 캡처만 보내면 된다 해서 복잡한 서류는 없었어요.",
  "개통·통신 비용은 0원으로 회사가 부담한다는 안내를 먼저 확인했어요.",
  "자동으로 이어지는 흐름이라 제가 할 일이 많지 않다는 점이 편했어요.",
  "당일 지급은 아니라는 말을 먼저 들어서 기대치를 맞췄어요.",
  "대출 브로커랑 달리 불법 느낌은 없었어요.",
  "1차 상담에서 본인 부담 0원 범위를 짚어 줘서 급전만 찾던 마음이 조금 가라앉았어요.",
  "지인 후기 보고 같은 유심 플랫폼 채널로 문의했는데 흐름이 비슷했어요."
];

const DISCOVERY_FORMAL = [
  "융통이 어려운 상황에서 유심 플랫폼(USIM PLUS) 관련 지원을 처음 알게 되었습니다.",
  "회사 측에서 절차를 일괄 진행한다는 안내를 확인하였습니다.",
  "유지 기간별 지급 안내표를 확인한 후 급전 지원 구조를 이해하였습니다.",
  "급한 자금 상황이었으나 불법 대출이 아닌 자격 확인 후 지원·지급임을 설명받았습니다.",
  "통신사 실적 및 회사 실적 확보를 위한 참여 프로그램이라는 설명을 들었습니다.",
  "담당자 안내에 따라 사진 캡처 위주로 제출하면 되어 부담이 적었습니다.",
  "개통·통신 관련 비용은 이용자 부담 0원으로 회사가 부담한다는 점을 사전에 확인하였습니다.",
  "자동 연계되는 절차로 이용자가 직접 처리할 단계가 적었습니다.",
  "당일 지급이 아님을 사전에 안내받아 기대치를 조정하였습니다.",
  "불법 대출처럼 느껴지지 않도록 절차를 분리해 설명하였습니다.",
  "1차 상담에서 본인 부담 금액이 없음을 짚어 주어 안심할 수 있었습니다.",
  "지인 후기와 유사한 순서로 유심 플랫폼 상담이 진행되었습니다."
];

const BRIDGE_CASUAL = [
  "그래서",
  "그러다",
  "돌이켜 보면",
  "솔직히",
  "개인적으로",
  "정리하자면",
  "덧붙이면",
  "한편"
];

const BRIDGE_FORMAL = [
  "이후",
  "정리하면",
  "추가로",
  "한편",
  "결과적으로",
  "이에",
  "아울러",
  "마지막으로"
];

const SCHEMA_COUNT = 10;

const OPENERS_CASUAL = [
  "처음엔 사기 아닌지 걱정했는데",
  "급전·융통이 막혀 막막하다가",
  "지인한테 유심 플랫폼 쪽도 보라는 말 듣고",
  "USIM PLUS 후기 검색하다가",
  "카페 글 보고 반신반의하며",
  "회사 동료가 비슷한 급전 지원 경험 있다고 해서",
  "전에 알던 대출 브로커랑은 달라 보여서",
  "급한 마음에 하루 만에 담당자에게 문의했는데",
  "여유 두고 지급 조건부터 비교하다가",
  "사진 캡처 보내는 게 부담스러워 망설이다가",
  "이 정도로 융통이 어려울 줄은 몰랐는데",
  "막연히 신용만 탓하다가",
  "연달아 거절당하고 나서",
  "통신사 실적 맞추는 프로그램이라는 말 듣고",
  "회사가 비용 전부 맡는다는 후기 보고",
  "사진만 찍어 보내면 된다는 안내 보고",
  "0원 참여 조건 글 읽고 반신반의하며",
  "급전 브로커 말고 플랫폼 쪽을 찾다가",
  "융통 막힌 주에 지인이 USIM PLUS를 알려줘서"
];

const OPENERS_FORMAL = [
  "처음에는 반신반의하였으나",
  "급전·융통이 어려워 막막한 가운데",
  "지인의 권유로 유심 플랫폼(USIM PLUS) 안내를 알게 되어",
  "인터넷 검색을 통해 후기를 확인하고",
  "커뮤니티 글을 참고하여",
  "직장 동료의 소개로",
  "과거 상담 경험과 달리 정돈된 플랫폼 안내로 보여",
  "급한 사정으로 당일 담당자에게 문의하였으나",
  "시간을 두고 지급 조건을 비교한 뒤",
  "사진 캡처 제출이 부담되어 잠시 망설였으나",
  "대출 심사가 생각보다 까다로워",
  "신용 상태만으로 판단하기 어려워",
  "연속 거절 이후에도",
  "통신사·회사 실적 프로그램이라는 설명을 듣고",
  "비용을 회사가 부담한다는 후기를 참고하여",
  "사진 캡처 위주 제출이라는 안내를 확인한 뒤",
  "이용자 부담 0원 조건을 검색하여",
  "급전 중개가 아닌 플랫폼 지원 경로를 찾다가",
  "융통 난항 중 지인의 USIM PLUS 소개로"
];

const PROCESS_CASUAL = [
  "담당자가 사진 캡처만 보내면 된다 해서 따라 하기 편했어요.",
  "회사가 개통·통신 절차를 대신 진행한다는 설명을 먼저 들어 안심했어요.",
  "유지 기간별 자금 지급 안내를 표로 정리해 줘서 헷갈리지 않았어요.",
  "본인 부담 0원·비용은 회사 부담이라는 걸 대화로 다시 확인할 수 있었어요.",
  "자동으로 이어지는 안내 흐름이 끊기지 않았어요.",
  "담당자 답장이 늦지 않아 진행 단계를 알 수 있었어요.",
  "같은 상담창에서 다음 캡처 안내를 받아 저장해 두기 좋았어요.",
  "조건 설명이 길지 않아 급전 지원 핵심만 빠르게 이해했어요.",
  "사진 재촬영 요청이 와도 이유를 설명해 줘서 납득했어요.",
  "유지 조건 충족 여부를 단계별로 짚어 주었어요.",
  "불법 대출이 아닌 자격 확인 후 지급이라는 점을 다시 확인했어요.",
  "절차가 복잡해 보였지만 회사 쪽에서 맡아서 순서대로 진행됐어요."
];

const PROCESS_FORMAL = [
  "담당자 안내에 따라 사진 캡처 전송 방법이 단순하여 따라 하기 수월하였습니다.",
  "회사 측에서 개통·통신 관련 절차를 일괄 진행한다는 설명을 먼저 들어 안심하였습니다.",
  "유지 기간별 자금 지급 안내를 표로 정리해 주어 혼동하지 않았습니다.",
  "이용자 부담 0원 및 통신·개통 비용 회사 부담을 대화로 재확인할 수 있었습니다.",
  "자동 연계되는 안내 흐름이 중단되지 않았습니다.",
  "담당자 답변이 지연되지 않아 진행 단계를 파악하기 좋았습니다.",
  "동일 상담창에서 후속 캡처 안내를 받아 기록하기 편하였습니다.",
  "조건 설명이 간결하여 급전 지원 핵심을 빠르게 이해하였습니다.",
  "사진 재촬영 요청 시에도 사유를 설명해 주어 납득하였습니다.",
  "유지 조건 충족 여부를 단계별로 짚어 주었습니다.",
  "불법 대출이 아닌 자격 확인 후 지원·지급임을 서면·대화로 재확인하였습니다.",
  "절차가 다소 복잡해 보였으나 회사 측 진행으로 순서대로 완료되었습니다."
];

const EXPERIENCE_CASUAL = [
  "급전이 필요했지만 지급 조건을 먼저 본 뒤 참여했어요.",
  "당일 지급은 아니라는 점은 미리 알고 시작했어요.",
  "본인 명의 회선 유지 책임은 본인에게 있다는 설명도 들었어요.",
  "궁금한 걸 담당자에게 다시 물어도 친절히 답해 줬어요.",
  "자격에 맞춰 진행 중이며 급전 지급 안내는 계속 받고 있어요.",
  "중간에 일정이 밀려도 담당자가 상담 일정을 조율해 줬어요.",
  "가족에게 설명할 때도 0원·회사 부담 안내를 그대로 전달하기 쉬웠어요.",
  "처음 상담과 마무리 안내 톤이 달라 헷갈리지 않았어요.",
  "본인이 낼 추가 비용 구간이 없다는 점을 미리 짚어 줘서 안심했어요.",
  "유지 기간별 지급 계산 기준을 예시로 들어 설명해 줬어요."
];

const EXPERIENCE_FORMAL = [
  "급한 자금·융통 상황이었으나 지급 조건을 먼저 확인한 뒤 참여하였습니다.",
  "당일 지급이 아님을 사전에 안내받고 시작하였습니다.",
  "본인 명의 회선 유지에 대한 책임은 본인에게 있음을 설명받았습니다.",
  "추가 문의에도 담당자가 성실히 답변해 주셨습니다.",
  "자격 조건에 맞춰 진행 중이며 지급 안내를 지속적으로 받고 있습니다.",
  "일정이 지연되어도 담당자가 상담 일정을 조율해 주셨습니다.",
  "가족에게 설명할 때도 이용자 부담 0원 안내를 그대로 전달하기 수월하였습니다.",
  "초기 상담과 마무리 안내의 톤이 일관되어 혼동하지 않았습니다.",
  "이용자 추가 부담이 없음을 미리 짚어 주어 급전 목적에 맞게 계획하기 수월하였습니다.",
  "유지 기간별 지급 계산 기준을 예시와 함께 설명해 주셨습니다."
];

const LOW_RATING_CASUAL = [
  "안내는 받았지만 제 상황과 맞지 않아 보류 중이에요.",
  "진행 속도가 기대보다 느려 답답한 구간이 있었어요.",
  "조건 설명을 두 번 읽어야 이해가 됐어요.",
  "사진 요청이 많아 번거로웠던 편이에요.",
  "유지 기간 계산이 헷갈려 다시 문의했어요."
];

const LOW_RATING_FORMAL = [
  "안내는 받았으나 제 상황과 맞지 않아 보류 중입니다.",
  "진행 속도가 기대보다 느려 답답한 구간이 있었습니다.",
  "조건 설명을 두 차례 확인해야 이해가 되었습니다.",
  "사진 요청이 잦아 다소 번거로웠습니다.",
  "유지 기간 계산이 헷갈려 재문의하였습니다."
];

const HIGH_RATING_CASUAL = [
  "전체적으로 차분하게 안내받아 마음이 놓였어요.",
  "궁금했던 부분을 짧게 정리해 줘서 좋았어요.",
  "다음 단계가 언제인지 미리 알려 줘서 일정 맞추기 편했어요.",
  "처음 상담 때 들은 내용과 나중 안내가 크게 달라지지 않았어요.",
  "주변에도 조건 먼저 보라고 말해 줄 정도로 정리가 잘 됐어요."
];

const HIGH_RATING_FORMAL = [
  "전반적으로 차분한 안내로 마음이 놓였습니다.",
  "궁금했던 부분을 간결히 정리해 주어 좋았습니다.",
  "다음 단계 시점을 사전에 알려 주어 일정 조율이 수월하였습니다.",
  "초기 상담 내용과 이후 안내가 크게 달라지지 않았습니다.",
  "주변에도 조건을 먼저 확인하라고 전할 정도로 정리가 잘 되어 있었습니다."
];

const FILLERS_CASUAL = [
  "개인적으로는 담당자 설명 톤이 딱딱하지 않아서 좋았어요.",
  "질문을 여러 번 했는데도 성의 있게 답해 주셨어요.",
  "회선 상태에 따라 지급 안내가 달라질 수 있다는 말도 들었어요.",
  "사진 캡처 예시를 보내 줘서 헷갈리지 않았어요.",
  "유심 플랫폼 상담 링크를 즐겨찾기해 두고 필요할 때 다시 열었어요.",
  "USIM PLUS 쪽 용어를 풀어서 설명해 줘서 이해가 빨랐어요.",
  "진행 중에도 지급 조건 변경 가능 여부를 물어봤는데 답이 명확했어요.",
  "참여 전후로 받은 0원·회사 부담 안내를 메모장에 남겨 두었어요.",
  "불법 대출이 아닌 플랫폼 지원·지급이라는 점을 여러 번 확인할 수 있었어요.",
  "급전·융통을 찾다가 알게 됐지만 번호이동만 하는 후기처럼 느껴지지는 않았어요."
];

const FILLERS_FORMAL = [
  "담당자 설명 톤이 지나치게 딱딱하지 않아 상담하기 편하였습니다.",
  "질문을 여러 차례 드렸으나 성실히 답변해 주셨습니다.",
  "회선 상태에 따라 지급 안내가 달라질 수 있음을 함께 안내받았습니다.",
  "사진 캡처 예시를 제공해 주어 혼동하지 않았습니다.",
  "유심 플랫폼 상담 링크를 저장해 두고 필요 시 다시 열어보았습니다.",
  "USIM PLUS 관련 용어를 풀어 설명해 주어 이해가 빨랐습니다.",
  "진행 중 지급 조건 변경 가능 여부를 문의하였고 답변이 명확하였습니다.",
  "참여 전후 이용자 부담 0원 안내 문구를 기록해 두었습니다.",
  "불법 대출이 아닌 자격 확인 후 지원·지급임을 여러 차례 확인할 수 있었습니다.",
  "급전·융통이 필요한 상황에서 알게 되었으나 개통 상담만 하는 후기처럼 느껴지지는 않았습니다."
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

/** Index + salt combinatorics (deterministic; reduces rng-only template repetition). */
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

/** Bijective timeline tuple for idx 0..9999 (feeds unique opening lines). */
function timelineForIndex(i) {
  const idx = i - 1;
  const daySpan = 31;
  const day = (idx % daySpan) + 1;
  const monthIdx = Math.floor(idx / daySpan) % MONTHS.length;
  const situationIdx = Math.floor(idx / (daySpan * MONTHS.length)) % SITUATIONS.length;
  const timeIdx =
    Math.floor(idx / (daySpan * MONTHS.length * SITUATIONS.length)) % TIMES.length;
  const variant = (Math.imul(idx, 0x85ebca6b) >>> 0) % 12;
  const minute = ((Math.imul(idx, 0x517cc1b7) >>> 0) % 59) + 1;
  return {
    month: MONTHS[monthIdx],
    day,
    situation: SITUATIONS[situationIdx],
    time: TIMES[timeIdx],
    variant,
    minute
  };
}

function leadSentence(i, channelKey, formal, uniqSalt = 0) {
  const channel = CHANNEL_LABEL[channelKey] || channelKey;
  const t = timelineForIndex(i);
  const minuteDisp = ((t.minute + uniqSalt * 17) % 59) + 1;
  const stage = STAGES[(i * 11) % STAGES.length];
  const stageCasual =
    stage === "consult"
      ? "상담 단계"
      : stage === "3"
        ? "3일 유지"
        : stage === "15"
          ? "15일 유지"
          : "30일 유지";
  const stageFormal =
    stage === "consult"
      ? "상담 단계"
      : stage === "3"
        ? "3일 유지"
        : stage === "15"
          ? "15일 유지"
          : "30일 유지";
  const stamp = `${t.month} ${t.day}일 ${minuteDisp}분경 ${t.time}`;
  const casual = [
    `${stamp}, ${t.situation} 상황이라 ${channel}으로 USIM PLUS 담당자에게 문의했어요.`,
    `${stamp} ${t.situation} 때 ${channel}에서 유심 플랫폼 상담을 시작했어요.`,
    `${stamp} ${channel}에서 급전 지원·지급 조건을 먼저 여쭤봤어요.`,
    `${stamp} 후기 보고 ${t.situation} 계기로 ${channel}에 연락했어요.`,
    `${stamp} 급전·융통이 막혀 ${channel}으로 유심 플랫폼 안내를 요청했어요.`,
    `${stamp} ${t.situation} 상태에서 ${channel} 상담 링크를 열어 0원 참여 조건을 확인했어요.`,
    `${stamp} ${channel} USIM PLUS 상담 — ${t.situation} 때문에 급전 지원 문의했어요.`,
    `${stamp} ${t.situation}, ${channel} 담당자에게 사진 캡처 절차부터 물어봤어요.`,
    `${stamp} ${channel}에서 0원·회사 부담 안내 받으려 ${t.situation} 쪽 문의했어요.`,
    `${stamp} ${channel} 열고 ${t.situation} 관련 급전 지급 조건 확인했어요.`,
    `${stamp} ${channel} 유심 플랫폼 자동 안내 따라 ${t.situation} 상담 시작했어요.`,
    `${stamp} USIM PLUS ${channel} 경로로 ${t.situation} 상황 담당자 연결 요청했어요.`,
    `${stamp} ${stageCasual} 급전 지급 조건, ${channel} USIM PLUS 상담 시작했어요.`
  ];
  const polite = [
    `${stamp}, ${t.situation} 상황으로 ${channel}에 USIM PLUS 담당자에게 문의하였습니다.`,
    `${stamp} ${t.situation} 때 ${channel}에서 유심 플랫폼 상담을 시작하였습니다.`,
    `${stamp} ${channel} 상담에서 급전 지원·지급 조건을 먼저 확인하였습니다.`,
    `${stamp} 후기를 참고하여 ${t.situation} 계기로 ${channel}으로 연락하였습니다.`,
    `${stamp} 급전·융통이 어려워 ${channel}을 통해 유심 플랫폼 안내를 요청하였습니다.`,
    `${stamp} ${t.situation} 상태에서 ${channel} 상담을 열어 이용자 부담 0원 조건을 확인하였습니다.`,
    `${stamp} ${channel} USIM PLUS 상담, ${t.situation} 사정으로 급전 지원을 문의하였습니다.`,
    `${stamp} ${t.situation}, ${channel} 담당자에게 사진 캡처 절차부터 확인하였습니다.`,
    `${stamp} ${channel}에서 0원·회사 부담 안내를 ${t.situation} 관련으로 요청하였습니다.`,
    `${stamp} ${channel}에 연락, ${t.situation} 관련 지급 조건을 확인하였습니다.`,
    `${stamp} ${channel} 유심 플랫폼 자동 안내에 따라 ${t.situation} 상담을 시작하였습니다.`,
    `${stamp} USIM PLUS ${channel} 경로, ${t.situation} 상황에서 담당자 연결을 요청하였습니다.`,
    `${stamp} ${stageFormal} 급전 지급 조건, ${channel} USIM PLUS 상담을 시작하였습니다.`
  ];
  const templates = formal ? polite : casual;
  const templateIdx = (t.variant + t.minute + uniqSalt * 13) % templates.length;
  return templates[templateIdx];
}

function closingAnchor(i, formal, t) {
  const dataModes = ["LTE 위주", "5G 위주", "데이터 위주", "통화·문자 위주"];
  const mode = pickAt(dataModes, i, 41);
  const casual = [
    `당시 ${mode} 사용 패턴 기준으로 담당자 안내를 받았고`,
    `사진 캡처만 보냈을 때 회사 쪽 절차가 이어졌고`,
    `${t.month} ${t.day}일 이후 유심 플랫폼 상담을 이어 가며`,
    `${t.time}에 받은 자동 안내 기준으로`,
    `유지 기간별 지급 안내를 다시 읽어 보며`,
    `급전 기대와 별개로 0원·지급 조건만 정리해 달라고 한 뒤`
  ];
  const polite = [
    `당시 ${mode} 사용 패턴을 기준으로 담당자 안내를 받았으며`,
    `사진 캡처만 제출하였을 때 회사 측 절차가 이어졌으며`,
    `${t.month} ${t.day}일 이후 유심 플랫폼 상담을 이어 가며`,
    `${t.time}에 받은 자동 안내를 기준으로`,
    `유지 기간별 지급 안내를 재확인하며`,
    `급한 자금 기대와 별개로 이용자 부담 0원·지급 조건만 정리해 달라고 요청한 뒤`
  ];
  const anchorList = formal ? polite : casual;
  const anchor = anchorList[t.variant % anchorList.length];
  return formal
    ? `${anchor}, 제가 기억하는 범위에서는 안내가 일관되었습니다.`
    : `${anchor}, 제가 기억하는 범위에서는 안내가 일관됐어요.`;
}

function ratingClause(pickIndex, rating, formal) {
  const high = formal ? HIGH_RATING_FORMAL : HIGH_RATING_CASUAL;
  const low = formal ? LOW_RATING_FORMAL : LOW_RATING_CASUAL;
  const mid = formal ? EXPERIENCE_FORMAL : EXPERIENCE_CASUAL;
  if (rating >= 4) return pickAt(high, pickIndex, 60 + rating);
  if (rating <= 2) return pickAt(low, pickIndex, 70 + rating);
  return pickAt(mid, pickIndex, 80 + rating);
}

function maybeEmoticon(i, formal, rating) {
  if (formal || rating < 4) return "";
  if ((i * 13 + 5) % 11 >= 4) return "";
  return " " + EMOTICONS[(i * 7) % EMOTICONS.length];
}

function composeBody(i, rating, channelKey, uniqSalt = 0) {
  const pickIndex = i + uniqSalt * 100_003;
  const formal = isFormalAgeBucket(ageBucketForIndex(i));
  const schema = (Math.imul(i, 0x27d4eb2d) >>> 0) % SCHEMA_COUNT;
  const openers = formal ? OPENERS_FORMAL : OPENERS_CASUAL;
  const process = formal ? PROCESS_FORMAL : PROCESS_CASUAL;
  const experience = formal ? EXPERIENCE_FORMAL : EXPERIENCE_CASUAL;
  const fillers = formal ? FILLERS_FORMAL : FILLERS_CASUAL;
  const discovery = formal ? DISCOVERY_FORMAL : DISCOVERY_CASUAL;
  const bridge = formal ? BRIDGE_FORMAL : BRIDGE_CASUAL;
  const t = timelineForIndex(i);
  const lead = leadSentence(i, channelKey, formal, uniqSalt);
  const parts = [lead];

  switch (schema) {
    case 0:
      parts.push(`${pickAt(openers, pickIndex, 1)} ${pickAt(process, pickIndex, 2)}`, ratingClause(pickIndex, rating, formal));
      parts.push(pickAt(experience, pickIndex, 3));
      break;
    case 1:
      parts.push(pickAt(discovery, pickIndex, 4));
      parts.push(`${pickAt(bridge, pickIndex, 5)}, ${pickAt(openers, pickIndex, 6)} ${pickAt(process, pickIndex, 7)}`);
      parts.push(ratingClause(pickIndex, rating, formal));
      break;
    case 2:
      parts.push(`${pickAt(bridge, pickIndex, 8)} ${pickAt(discovery, pickIndex, 9)}`);
      parts.push(pickAt(process, pickIndex, 10), pickAt(experience, pickIndex, 11));
      parts.push(ratingClause(pickIndex, rating, formal));
      break;
    case 3:
      parts.push(pickAt(process, pickIndex, 12));
      parts.push(`${pickAt(bridge, pickIndex, 13)} ${pickAt(discovery, pickIndex, 14)}`);
      parts.push(pickAt(experience, pickIndex, 15), ratingClause(pickIndex, rating, formal));
      break;
    case 4:
      parts.push(`${pickAt(openers, pickIndex, 16)} ${pickAt(discovery, pickIndex, 17)}`);
      parts.push(pickAt(process, pickIndex, 18), ratingClause(pickIndex, rating, formal));
      break;
    case 5:
      parts.push(pickAt(discovery, pickIndex, 19));
      parts.push(pickAt(process, pickIndex, 20), pickAt(experience, pickIndex, 21));
      parts.push(ratingClause(pickIndex, rating, formal));
      break;
    case 6:
      parts.push(ratingClause(pickIndex, rating, formal));
      parts.push(`${pickAt(openers, pickIndex, 22)} ${pickAt(process, pickIndex, 23)}`, pickAt(discovery, pickIndex, 24));
      break;
    default:
      parts.push(pickAt(process, pickIndex, 25));
      parts.push(`${pickAt(bridge, pickIndex, 26)} ${pickAt(openers, pickIndex, 27)} ${pickAt(experience, pickIndex, 28)}`);
      parts.push(ratingClause(pickIndex, rating, formal), pickAt(discovery, pickIndex, 29));
      break;
  }

  const extraCount = (i % 5) + (rating >= 5 ? 1 : 0) + (schema % 3);
  for (let e = 0; e < extraCount; e += 1) {
    parts.push(pickAt(fillers, pickIndex, 90 + e));
  }

  parts.push(closingAnchor(i, formal, t) + maybeEmoticon(i, formal, rating));

  let body = parts.join(" ").replace(/\s+/g, " ").trim();
  let pad = 0;
  while (body.length < REVIEW_BODY_MIN) {
    body += ` ${pickAt(fillers, pickIndex, 200 + pad)}`;
    pad += 1;
  }
  if (body.length > REVIEW_BODY_MAX) {
    body = body.slice(0, REVIEW_BODY_MAX - 1).trim() + "…";
  }
  return body;
}

export function generateReviewRows(count = 10_000) {
  const rows = [];
  const bodySha = new Set();
  const normSha = new Set();
  const snippetSha = new Set();
  const snippetPrefix60 = new Set();
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  const spanMs = end.getTime() - start.getTime();
  for (let i = 1; i <= count; i += 1) {
    const channel = CHANNELS[(i * 7) % CHANNELS.length];
    const rating = ratingForIndex(i, count);
    const rng = mulberry32(i * 999_983);
    const formal = isFormalAgeBucket(ageBucketForIndex(i));
    let body = "";
    let hashes = null;
    for (let uniqSalt = 0; uniqSalt < 128; uniqSalt += 1) {
      body = composeBody(i, rating, channel, uniqSalt);
      hashes = dedupHashesForBody(body);
      const prefix60 = hashes.snippet.slice(0, 60);
      if (
        !bodySha.has(hashes.body_sha256) &&
        !normSha.has(hashes.body_norm_sha256) &&
        !snippetSha.has(hashes.snippet_sha256) &&
        !snippetPrefix60.has(prefix60)
      ) {
        break;
      }
    }
    const prefix60 = hashes.snippet.slice(0, 60);
    if (
      bodySha.has(hashes.body_sha256) ||
      normSha.has(hashes.body_norm_sha256) ||
      snippetSha.has(hashes.snippet_sha256) ||
      snippetPrefix60.has(prefix60)
    ) {
      throw new Error(`Could not dedupe review body for row ${i}`);
    }
    bodySha.add(hashes.body_sha256);
    normSha.add(hashes.body_norm_sha256);
    snippetSha.add(hashes.snippet_sha256);
    snippetPrefix60.add(prefix60);
    const published = new Date(start.getTime() + (spanMs * i) / count);
    rows.push({
      /** Admin import dedup key only — never embedded in public review text. */
      rowId: String(i).padStart(5, "0"),
      publishedAt: published.toISOString(),
      rating,
      displayName: displayNameFor(i, rng, formal),
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
