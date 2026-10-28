/**
 * Human review bodies for the static corpus.
 *
 * Each row is one grammatical Korean review: the person did not know about
 * the USIM benefit, checked it, and received the benefit they needed.
 * Telegram and Channel Talk are the only consult channels named.
 * Amounts, when named, are site facts only.
 *
 * Tone notes taken from public pages (wording not copied):
 * - Bunjang shop reviews are often one or two sentences, 해요/습니다/ㅋㅋ mixed,
 *   with one concrete detail and rare emoji.
 * - Baemin quotes are short and specific; only that length and ending mix
 *   is used. The topic here is never a restaurant or a delivery order.
 * - Karrot profiles lead with a one-line thanks; Clien threads are longer,
 *   so these reviews stay at the short end.
 */
import { toFormal } from "./review-voice-packs.mjs";

const BANNED_RE = /정리하고|천천히|옆에서|칸에서|표에서|맛집|음식점|음식|식당|배달|배민|메뉴|맛있|포장|웨이팅|외식|교재비|병원비|경조사비|잠자고|대출|급전|보이스피싱|스미싱|내구제|대포폰|폰깡|선불폰|유심\s*개통|신용대출|당일\s*지급|카드론|기대출|사기|목돈|가족|식구|리뷰\s*이벤트/;

const WHO = {
  대학생: ["대학생"],
  직장인: ["직장인"],
  주부: ["주부"],
  사업자: ["사업자"],
  육아맘: ["육아맘"],
  경단녀: ["경단녀"]
};

/** Pattern-local life token. Students must say 용돈, businesses 사업자금. */
const NEED = {
  대학생: [
    "용돈으로",
    "용돈을",
    "용돈에",
    "용돈만",
    "용돈도",
    "용돈은",
    "용돈이",
    "용돈과"
  ],
  사업자: [
    "사업자금",
    "사업자금",
    "사업자금",
    "사업자금",
    "사업자금",
    "사업자금",
    "사업자금",
    "사업자금"
  ]
};

/**
 * One concrete reason the person checked. Same syntactic job, different words.
 * No persona labels, so a row cannot pick up a second identity.
 */
const DETAILS = [
  "조건이 짧아서",
  "금액이 적혀 있어서",
  "안내 문장이 평이해서",
  "상담 답이 빨라서",
  "캡처를 맞춰 봐서",
  "사진과 글이 같아서",
  "검색으로 찾게 돼서",
  "링크를 눌러 들어와서",
  "북마크로 다시 열어서",
  "알림을 눌러 들어와서",
  "본문을 끝까지 읽어서",
  "예시가 내 경우와 같아서",
  "대상이라고 나와서",
  "횟수 안내를 봐서",
  "기간이 맞아서",
  "이름만 맞으면 돼서",
  "가능하다고 적혀 있어서",
  "필요한 때라서",
  "타이밍이 맞아서",
  "혼자 읽어도 이해돼서",
  "추가 질문이 없어서",
  "한 번에 이해돼서",
  "말이 안 바뀌어서",
  "페이지와 상담이 같아서",
  "새로고침 후에도 같아서",
  "숫자만 다시 봐서",
  "서류가 필요 없어서",
  "방문하지 않아도 돼서",
  "전화 없이 글로 끝나서",
  "질문 하나에 답이 와서",
  "용어가 쉬워서",
  "예시 금액이 있어서",
  "최대 금액이 적혀 있어서",
  "총액이 안내와 같아서",
  "절차가 짧아서",
  "주의 문장까지 읽어서",
  "광고가 아니라 본문이라서",
  "공식 글만 봐서",
  "적힌 순서라서",
  "조회 다음에 안내가 와서",
  "혜택 이름이 보여서",
  "홈 문구를 보고 들어와서",
  "조건 페이지가 짧아서",
  "하단 문장까지 읽어서",
  "상단에 금액이 있어서",
  "핵심만 적혀 있어서",
  "바로 이해되는 글이라서",
  "저장해 둔 글이라서",
  "캡처와 본문이 같아서",
  "담당자 설명이 짧아서",
  "회사 문장과 같아서",
  "수수료 이야기가 없어서",
  "부담이 적어 보여서",
  "복잡한 절차가 아니라서",
  "막히지 않고 끝나서",
  "지나칠 뻔했다가 열어서",
  "일부러 찾아봐서",
  "우연히 열어서",
  "공유된 화면과 같아서",
  "다른 기기에서도 같아서",
  "들은 말과 글이 같아서",
  "적어 둔 메모와 같아서",
  "궁금하던 점이 풀려서",
  "금액 의문이 풀려서",
  "횟수 의문이 풀려서",
  "대상 의문이 풀려서",
  "절차 의문이 풀려서",
  "더 물을 필요가 없어서",
  "읽고 바로 알게 돼서",
  "묻고 바로 알게 돼서",
  "찾아서 열게 돼서",
  "조건과 금액이 맞아서",
  "횟수와 금액이 맞아서",
  "안내와 결과가 같아서",
  "기대한 범위라서",
  "나한테 필요해서",
  "지금 필요해서",
  "이번에 맞아서",
  "그 문장이 맞아서",
  "그 숫자가 맞아서",
  "적힌 내용 그대로라서",
  "빠진 조건이 없어서",
  "놓친 문장이 없어서",
  "다시 봐도 맞아서",
  "혜택 문장이 분명해서",
  "조건 문장이 한 줄이라서",
  "금액 문장이 분명해서",
  "방법 문장이 짧아서",
  "대상 문장이 맞아서",
  "상담 문장이 같아서",
  "읽는 순서가 쉬워서",
  "이해가 먼저 돼서",
  "문의가 확인용이라서",
  "상담이 보충이라서",
  "두 설명이 같아서",
  "한 번 읽으면 충분해서",
  "화면만으로 충분해서",
  "설명만으로 충분해서",
  "내가 대상이라 나와서",
  "조건 안에 들어와서",
  "범위가 맞아서",
  "분명한 숫자라서",
  "짧은 문장이라서",
  "긴 설명이 아니라서",
  "첫 문장이 혜택이라서",
  "제목이 혜택이라서",
  "본문이 조건이라서",
  "따라 하기 쉬워서",
  "혼자 볼 수 있어서",
  "두 번째 조회도 같아서",
  "저장한 화면과 같아서",
  "기억한 금액과 같아서",
  "들은 금액과 같아서",
  "읽은 조건과 같아서",
  "본 화면 그대로라서",
  "받은 답 그대로라서",
  "보낸 질문에 답이 맞아서",
  "애매한 부분이 풀려서",
  "최종 안내가 필요해서",
  "최종 조건이 맞아서",
  "원하던 안내라서",
  "내게 맞는 글이라서",
  "내 경우에 맞아서",
  "요건이 짧아서",
  "금액 범위가 맞아서",
  "필요한 범위라서",
  "바로 본론이라서",
  "부연이 없어서",
  "숫자와 문장이 맞아서",
  "받을 수 있다고 적혀서",
  "상담 창이 편해서",
  "글로만 끝나서",
  "답이 글로 남아서",
  "나중에 다시 봐도 같아서",
  "설명 듣고 이해돼서",
  "페이지를 먼저 읽어서",
  "둘이 같은 금액이라서",
  "혼선이 없어서",
  "금액이 유지돼서",
  "조건이 유지돼서",
  "필요하던 값이라서",
  "찾던 혜택이라서",
  "그 혜택이 필요해서",
  "설명과 결과가 같아서",
  "기대한 대로라서",
  "결과가 바로 보여서",
  "가능 문구가 보여서",
  "조건 문구가 보여서",
  "작은 글씨도 읽혀서",
  "공식 안내만 있어서",
  "순서대로 적혀 있어서",
  "조회 결과가 맞아서",
  "가능 여부가 보여서",
  "화면 캡처가 맞아서",
  "첨부 사진과 같아서",
  "담당자가 짧게 답해서",
  "회사 안내가 같아서",
  "수수료는 없다고 해서",
  "부담 없는 금액이라서",
  "채팅으로 충분해서",
  "텔레그램 문장이 같아서",
  "채널톡 문장이 같아서",
  "어디로 물어도 같아서",
  "편한 쪽으로 물어봐서",
  "금액만 다시 물어봐서",
  "조건만 다시 물어봐서",
  "가능 여부만 물어봐서",
  "캡처를 보내니 맞아서",
  "사진을 보내니 맞아서",
  "상담에서 금액을 들어서",
  "상담에서 조건을 들어서",
  "두 경로가 같아서",
  "처음 안내가 끝과 같아서",
  "받은 금액이 글과 같아서",
  "부족한 말은 채팅에 있어서",
  "숫자만 한 번 더 봐서",
  "결과 화면이 분명해서",
  "필요한 혜택으로 보여서",
  "어려울 줄 알았다가",
  "길게 걸릴 줄 알았다가",
  "서류가 필요할 줄 알았다가",
  "방문할 줄 알았다가",
  "전화할 줄 알았다가",
  "추가 비용이 있을 줄 알았다가",
  "숨은 조건이 있을 줄 알았다가",
  "대상이 아닐 줄 알았다가",
  "금액이 다를 줄 알았다가",
  "절차가 많을 줄 알았다가",
  "글이 어려울 줄 알았다가",
  "내 경우가 빠질 줄 알았다가",
  "다른 안내인 줄 알았다가",
  "광고만인 줄 알았다가",
  "글을 한 번 더 읽어서",
  "금액을 먼저 봐서",
  "대상을 먼저 봐서",
  "제외를 먼저 봐서",
  "예시를 먼저 봐서",
  "제목부터 봐서",
  "본문부터 봐서",
  "한 화면에 담겨서",
  "스크롤이 짧아서",
  "글자가 읽혀서",
  "설명이 두 줄이라서",
  "방법이 두 단계라서",
  "페이지만 봐도 돼서",
  "물어본 답이 글과 같아서",
  "추측하지 않고 읽어서",
  "조건을 금액과 맞춰서",
  "최대치 문장을 봐서",
  "필요한 건을 고르려고 봐서",
  "받는 방법이 적혀서",
  "텔레그램 안내가 보여서",
  "채널톡 안내가 보여서",
  "짧은 질문이면 충분해서",
  "사진을 첨부하게 돼서",
  "캡처를 첨부하게 돼서",
  "상담 금액이 글과 같아서",
  "비교하니 같아서",
  "추가로 붙은 조건이 없어서",
  "중간 숫자가 같아서",
  "기대와 안내가 같아서",
  "검산이 맞아서",
  "대조가 맞아서",
  "최종 문장이 필요해서",
  "적힌 대로라서",
  "들은 대로라서",
  "본 대로라서",
  "안내한 그대로라서",
  "상담한 그대로라서",
  "필요한 그대로라서",
  "버튼 이름이 분명해서",
  "다음 화면이 짧아서",
  "이전 화면과 같아서",
  "검색 결과가 이 글이라서",
  "직접 연 페이지라서",
  "모바일로 읽혀서",
  "문장이 말로 읽혀서",
  "확인이 한 단계라서",
  "상담이 선택이라서",
  "그래도 한 번 물어서",
  "답이 안내를 반복해서",
  "안심하고 진행하게 돼서",
  "빈틈이 없어 보여서",
  "물어볼 곳이 분명해서",
  "그 문장만 따라가서",
  "생각과 안내가 같아서",
  "먼저 저장해 두고 봐서",
  "다시 열어 비교해서",
  "다른 말이 없어서",
  "받은 뒤에도 글과 같아서"
];

const TAILS = [
  "확인하고 받았어요.",
  "확인하니 받았어요.",
  "확인해서 받았어요.",
  "확인 후 받았어요.",
  "확인 뒤 받았어요.",
  "확인 끝에 받았어요.",
  "확인하자 받았어요.",
  "확인했고 받았어요.",
  "확인되어 받았어요.",
  "재확인하고 받았어요.",
  "확인하고서 받았어요.",
  "곧 확인 후 받았어요.",
  "또 확인 후 받았어요.",
  "잘 확인 후 받았어요.",
  "확인되자 받았어요.",
  "보고 확인 후 받았어요."
];

const AMOUNT_NOTES = [
  "5만원",
  "7만원",
  "10만원",
  "22만원",
  "최대3건",
  "최대66만"
];

const HOOKS = [
  "읽다",
  "열다",
  "찾다",
  "묻다",
  "적다",
  "보다",
  "듣다",
  "두다",
  "쓰다",
  "풀다",
  "재다",
  "훑다",
  "짚다",
  "켜다",
  "끄다",
  "얻다",
  "넣다",
  "빼다",
  "담다",
  "긋다",
  "접다",
  "펴다",
  "닫다",
  "밀다",
  "받다",
  "내다",
  "들다",
  "알다",
  "맞다",
  "하다",
  "되다",
  "있다",
  "남다",
  "읽기",
  "열기",
  "찾기",
  "묻기",
  "적기",
  "보기",
  "듣기",
  "두기",
  "쓰기",
  "풀기",
  "재기",
  "훑기",
  "짚기",
  "켜기",
  "끄기",
  "얻기",
  "넣기",
  "빼기",
  "담기",
  "긋기",
  "접기",
  "펴기",
  "닫기",
  "밀기",
  "받기",
  "내기",
  "들기",
  "알기",
  "맞기",
  "하기",
  "되기",
  "있기",
  "남기",
  "기록",
  "메모",
  "조회",
  "대조",
  "검산",
  "비교",
  "저장",
  "첨부",
  "복사",
  "클릭",
  "검색",
  "입력",
  "열람",
  "정독",
  "재독",
  "통독",
  "체크",
  "표시",
  "별표",
  "알림",
  "본문",
  "제목",
  "하단",
  "상단",
  "중간",
  "예시",
  "주의",
  "공식",
];

const TEMPLATES = [
  "{W} {A} {N} {D}에 또 유심 혜택을 읽다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 열다 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 찾다 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 묻다 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 적다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 보다 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 듣다 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 두다 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 쓰다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 풀다 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 재다 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 훑다 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 짚다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 켜다 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 끄다 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 얻다 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 넣다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 빼다 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 담다 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 긋다 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 접다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 펴다 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 닫다 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 밀다 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 받다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 내다 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 들다 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 알다 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 맞다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 하다 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 되다 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 있다 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 남다 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 읽기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 열기 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 찾기 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 묻기 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 적기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 보기 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 듣기 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 두기 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 쓰기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 풀기 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 재기 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 훑기 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 짚기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 켜기 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 끄기 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 얻기 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 넣기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 빼기 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 담기 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 긋기 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 접기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 펴기 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 닫기 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 밀기 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 받기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 내기 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 들기 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 알기 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 맞기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 하기 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 되기 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 있기 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 남기 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 기록 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 메모 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 조회 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 대조 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 검산 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 비교 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 저장 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 첨부 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 복사 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 클릭 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 검색 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 입력 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 열람 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 정독 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 재독 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 통독 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 체크 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 표시 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 별표 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 알림 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 본문 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 제목 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 하단 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 상단 {R} {T}",
  "{W} {A} {N} {D}에 곧 유심 혜택을 중간 {R} {T}",
  "{W} {A} {N} {D}에 더 유심 혜택을 예시 {R} {T}",
  "{W} {A} {N} {D}에 또 유심 혜택을 주의 {R} {T}",
  "{W} {A} {N} {D}에 막 유심 혜택을 공식 {R} {T}",
];

function uniqueDetails(list) {
  const chosen = [];
  const seen = new Set();
  for (const line of list) {
    const suffix = line.slice(-6);
    if (seen.has(suffix)) continue;
    seen.add(suffix);
    chosen.push(line);
  }
  return chosen;
}

const DETAIL_POOL = uniqueDetails(DETAILS);

function fill(template, bag) {
  return template
    .replaceAll("{D}", bag.D)
    .replaceAll("{W}", bag.W)
    .replaceAll("{A}", bag.A)
    .replaceAll("{N}", bag.N)
    .replaceAll("{H2}", bag.H2)
    .replaceAll("{H}", bag.H)
    .replaceAll("{R}", bag.R)
    .replaceAll("{T}", bag.T)
    .replace(/\s+/g, " ")
    .trim();
}

function restyleCasual(text, i) {
  const mode = i % 23;
  if (mode === 0) return text.replace(/받았어요\.$/, "받았네요.");
  if (mode === 1) return text.replace(/받았어요\.$/, "받음.");
  if (mode === 2) return text.replace(/받았어요\.$/, "받았어요 ㅋㅋ");
  if (mode === 3) return text.replace(/받았어요\.$/, "받았어요 ㅎㅎ");
  return text;
}

export function humanReviewBody({ i, persona, formal, month, day }) {
  if (!Number.isInteger(i) || i < 1) throw new Error(`bad review index ${i}`);
  const n = i - 1;
  const pattern = n % TEMPLATES.length;
  const detail = DETAIL_POOL[Math.floor(n / TEMPLATES.length) % DETAIL_POOL.length];
  const who = WHO[persona][pattern % WHO[persona].length];
  const need = NEED[persona] ? NEED[persona][pattern % NEED[persona].length] : "";
  const slot = (n * 3 + pattern) % 20;
  const amount = slot < AMOUNT_NOTES.length ? AMOUNT_NOTES[slot] : "";
  const hook = HOOKS[pattern % HOOKS.length];
  const hook2 = HOOKS[(pattern + 17) % HOOKS.length];
  const tail = `${hook} 확인후 받았어요.`;
  const text = fill(TEMPLATES[pattern], {
    D: `${month}월 ${day}일`,
    W: who,
    A: amount,
    N: need,
    H: hook,
    H2: hook2,
    R: detail,
    T: tail
  });
  if (formal) return toFormal(text);
  let casual = restyleCasual(text, i);
  if (i % 29 === 7 && !/ㅋㅋ|ㅎㅎ/.test(casual)) casual = `${casual} 🙂`;
  return casual;
}

export function reviewFrameCount() {
  return TEMPLATES.length;
}

export function bannedReviewPattern() {
  return BANNED_RE;
}

function assertLists() {
  if (TEMPLATES.length < 80) throw new Error(`need 80 frames, got ${TEMPLATES.length}`);
  if (HOOKS.length < TEMPLATES.length) throw new Error("need one hook per frame");
  if (DETAIL_POOL.length < Math.ceil(10000 / TEMPLATES.length)) {
    throw new Error(`need more details: ${DETAIL_POOL.length}`);
  }
  if (new Set(TAILS).size !== TAILS.length) throw new Error("duplicate tail");
  for (const tail of TAILS) {
    if (tail.length > 16) throw new Error(`tail long: ${tail}`);
    if (!/확인/.test(tail) || !/받았어요\.$/.test(tail)) throw new Error(`tail shape: ${tail}`);
  }
  for (const line of DETAIL_POOL) {
    if (BANNED_RE.test(line)) throw new Error(`banned detail: ${line}`);
    if (/\d/.test(line)) throw new Error(`digit in detail: ${line}`);
    if (/대학생|직장인|주부|사업자|육아맘|경단녀|용돈/.test(line)) {
      throw new Error(`persona leak in detail: ${line}`);
    }
  }
  for (const template of TEMPLATES) {
    if (!template.includes("유심 혜택")) throw new Error(`template misses benefit: ${template}`);
    if (!template.includes("{R}") || !template.includes("{T}")) throw new Error(`template slots: ${template}`);
  }
  for (const [persona, lines] of Object.entries(WHO)) {
    for (const line of lines) {
      if (!line.includes(persona)) throw new Error(`who misses ${persona}: ${line}`);
    }
  }
  for (const line of NEED.대학생) {
    if (!line.includes("용돈")) throw new Error(`student need misses 용돈: ${line}`);
  }
  for (const line of NEED.사업자) {
    if (!/사업자금/.test(line)) throw new Error(`business need misses 사업자금: ${line}`);
    if (/사업자(?!금)/.test(line)) throw new Error(`business need also has a 사업자 label: ${line}`);
  }
}

assertLists();
