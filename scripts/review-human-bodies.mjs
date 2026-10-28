/**
 * Grammatical Korean review sentences for the static corpus.
 *
 * Each template is already a complete review: the person did not know about
 * the USIM benefit, checked it, and received what they needed. Slots are only
 * an amount, a channel name (텔레그램/채널톡), and an optional time word.
 * A fill that matches the reject list is skipped and another fill is used.
 */
const WHEN = ["", "오전에 ", "오후에 ", "저녁에 ", "밤에 ", "어제 ", "오늘 ", "아까 ", "방금 ", "점심에 ", "새벽에 ", "아침에 "];
const CHANNELS = ["텔레그램", "채널톡"];
const AMT_LOW = ["", "5만원", "7만원", "10만원"];
const AMT_HIGH = ["22만원", "66만원"];

/** Bodies must not match this. Dictionary-form verbs and the banned slot glue. */
export const FORBIDDEN_REVIEW_RE =
  /읽다|열다|찾다|묻다|조건이 짧|확인후|사업자금|맛집|음식점|외식|대출|급전/;

const EXTRA_FORBIDDEN_RE =
  /식당|배달|배민|메뉴|맛있|포장|웨이팅|보이스피싱|스미싱|내구제|대포폰|폰깡|선불폰|유심\s*개통|신용대출|당일\s*지급|카드론|기대출|사기|정리하고|천천히|옆에서|칸에서|표에서|교재비|병원비|경조사|잠자고|가족|식구/;

const BANNED_RE = new RegExp(`${FORBIDDEN_REVIEW_RE.source}|${EXTRA_FORBIDDEN_RE.source}`);

const SPEECH = [
  ["몰랐어요", "몰랐습니다"],
  ["알았어요", "알았습니다"],
  ["들어왔어요", "들어왔습니다"],
  ["들어왔네요", "들어왔습니다"],
  ["받았어요", "받았습니다"],
  ["확인했어요", "확인했습니다"],
  ["들었어요", "들었습니다"],
  ["봤어요", "봤습니다"],
  ["있었어요", "있었습니다"],
  ["없었어요", "없었습니다"],
  ["됐어요", "됐습니다"],
  ["왔어요", "왔습니다"],
  ["했어요", "했습니다"]
];

/** @type {Array<{ text: string, amounts: string[], group: string }>} */
const TEMPLATES = [
  // --- did not know, then checked ---
  { group: "low", text: "{when}{ch}에서 {amt} 유심 혜택이 있는 줄 몰랐는데 직접 확인해 보니 제가 해당돼서 받았어요." },
  { group: "low", text: "{when}저는 해당이 안 되는 줄 알았는데 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택은 몰랐어요. {ch}에서 조건이 맞는지 확인하고 받았어요." },
  { group: "low", text: "{when}그냥 넘길 뻔했는데 {ch}으로 {amt} 유심 혜택을 확인해 보고 받았어요." },
  { group: "low", text: "{when}{ch}에서 안내를 듣기 전에는 {amt} 유심 혜택이 있는 줄 몰랐고 확인한 뒤 받았어요." },
  { group: "low", text: "{when}광고인 줄 알았다가 {ch}에서 {amt} 유심 혜택인지 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 물어보기 전에는 {amt} 유심 혜택을 몰랐는데 확인하고 받았어요." },
  { group: "low", text: "{when}지인 얘기로 처음 듣고 {ch}에서 {amt} 유심 혜택인지 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 글이 보여서 {ch}에서 제 경우인지 확인하고 받았어요." },
  { group: "low", text: "{when}검색에 나와서 {ch}으로 {amt} 유심 혜택을 직접 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 이름을 맞춰 보고 {amt} 유심 혜택 대상이라고 확인한 뒤 받았어요." },
  { group: "low", text: "{when}저한테는 아닐 줄 알았는데 {ch}에서 {amt} 유심 혜택을 확인해 보니 해당돼서 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택이 따로 있는 줄 몰랐어요. {ch}으로 확인하고 나서 받았어요." },
  { group: "low", text: "{when}홈 화면 문구를 보고 {ch}에서 {amt} 유심 혜택을 확인한 다음 받았어요." },
  { group: "low", text: "{when}{ch}에서 짧게 설명 듣고 {amt} 유심 혜택이 맞는지 확인한 뒤 받았어요." },
  { group: "low", text: "{when}예전에는 이런 안내를 못 봤어요. {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 링크를 받아 보고 그제야 {amt} 유심 혜택인 줄 확인하고 받았어요." },
  { group: "low", text: "{when}제 명의로도 되나 싶었는데 {ch}에서 {amt} 유심 혜택을 확인해 보니 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 문구가 낯설어서 {ch}으로 다시 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 설명을 들으면서 {amt} 유심 혜택이 맞는 걸 확인하고 받았어요." },
  { group: "low", text: "{when}설명을 끝까지 듣고 {ch}에서 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{ch}으로 질문 하나 남겼더니 {amt} 유심 혜택이라고 해서 확인하고 받았어요." },
  { group: "low", text: "{when}처음 화면만 보고 닫을 뻔했는데 {ch}에서 {amt} 유심 혜택을 다시 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택이 제게 해당되는지 {ch}으로 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 예시랑 제 상황을 비교하고 {amt} 유심 혜택을 확인한 다음 받았어요." },

  // --- checked the condition, then received ---
  { group: "low", text: "{when}상담에서 조건을 듣고 {ch}에서 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택이 가능한지 {ch}에서 먼저 확인하고 필요한 만큼만 받았어요." },
  { group: "low", text: "{when}{ch}으로 조건을 물어보고 {amt} 유심 혜택을 확인한 다음 받았어요." },
  { group: "low", text: "{when}적힌 순서대로 {ch}에서 {amt} 유심 혜택을 확인하고 안내대로 받았어요." },
  { group: "low", text: "{when}{ch}에서 대상 여부를 먼저 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}금액보다 조건을 먼저 봤어요. {ch}으로 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 범위 안인지 {ch}에서 확인하고 필요한 만큼 받았어요." },
  { group: "low", text: "{when}{ch}에서 안내 문장과 상담 말이 같아서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}헷갈리던 부분만 {ch}으로 다시 묻고 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{ch}에서 횟수랑 금액을 같이 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}복잡한 절차는 아니라서 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 조건이 이해된 뒤에 {ch}으로 한 번 더 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 캡처랑 본문을 맞춰 보고 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}전화 없이 글로 충분하다길래 {ch}으로 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 제 경우에 맞는지 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}추가 질문 없이 끝났고 {ch}에서 {amt} 유심 혜택을 확인한 대로 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 안내가 분명해서 {ch}으로 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 들은 금액과 글의 금액이 같아서 유심 혜택을 확인하고 {amt} 받았어요." },
  { group: "low", text: "{when}방문하지 않아도 된다길래 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 받은 답이 글과 같아서 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}제가 읽을 수 있는 문장이라 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택인지 화면으로 먼저 확인하고 {ch}에서 안내대로 받았어요." },
  { group: "low", text: "{when}{ch}에서 누락된 조건이 없는지 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}두 번째에도 같은 안내라 {ch}으로 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 최종 안내만 다시 확인하고 {amt} 유심 혜택을 받았어요." },

  // --- received after checking, phone-note shape ---
  { group: "low", text: "{when}{amt} 들어왔어요. {ch}에서 유심 혜택인 줄 모르고 있다가 확인하고 받았어요." },
  { group: "low", text: "{when}안내대로 {amt} 들어왔어요. {ch}으로 유심 혜택을 먼저 확인하고 받았어요." },
  { group: "low", text: "3일 지나고 {amt} 들어왔어요. {when}{ch}에서 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "3일 지나고 {amt} 들어왔어요. {when}안내는 {ch}으로 왔고 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "며칠 뒤에 {amt} 들어왔어요. {when}{ch}으로 유심 혜택 안내를 받고 확인해서 받았어요." },
  { group: "low", text: "다음 날 {amt} 들어왔어요. {when}{ch}에서 유심 혜택을 확인한 다음 받았어요." },
  { group: "low", text: "3일 지나고 나서 확인하니 {amt} 유심 혜택이 들어와 있었어요. {when}{ch}에서 안내받은 대로 받았어요." },
  { group: "low", text: "{when}{ch}에서 확인한 {amt} 유심 혜택이 며칠 뒤에 들어와서 안내대로 받았어요." },
  { group: "low", text: "{when}필요한 만큼만 받자고 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 진행 여부를 확인하고 {amt} 유심 혜택을 필요한 만큼만 받았어요." },
  { group: "low", text: "{when}과하게 받지 않고 {ch}에서 {amt} 유심 혜택을 확인한 뒤 필요한 선에서 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택을 확인한 뒤에야 {ch}으로 신청해서 받았어요." },
  { group: "low", text: "{when}{ch}에서 가능하다고 확인된 {amt} 유심 혜택만 골라서 받았어요." },
  { group: "low", text: "{when}상담 창에 남은 글대로 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 사진 대신 글 안내를 받고 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}제가 이해한 내용이 맞는지 {ch}에서 {amt} 유심 혜택인지 다시 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 이름이 보여서 {ch}으로 조건을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 상단 안내를 읽고 나서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}하단 주의까지 본 다음 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 받은 안내가 충분해서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}다른 상품인 줄 알았는데 {ch}에서 {amt} 유심 혜택이 맞다고 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택만 따로 있다고 {ch}에서 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 제 상황에 해당된다고 확인한 뒤 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}부담되는 절차는 없어서 {ch}으로 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 숫자만 다시 확인해 보고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}기억하던 금액과 같아서 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 안내를 {ch}으로 다시 듣고 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{ch}에서 막히지 않고 끝나서 {amt} 유심 혜택을 확인한 대로 받았어요." },
  { group: "low", text: "{when}궁금증이 풀린 뒤에 {ch}으로 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 대상 문장이 제 경우라 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}한 번 보고 이해가 돼서 {ch}에서 {amt} 유심 혜택을 확인한 다음 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택을 저장해 뒀다가 {ch}으로 다시 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 새로 고친 안내도 같아서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}들은 조건을 {ch}에서 다시 보고 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 핵심만 듣고 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}제가 필요한 범위라서 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택이 지금 필요하다고 보고 {ch}으로 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{ch}에서 이번 조건에 든다고 해서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}빠져 있던 설명을 {ch}에서 듣고 {amt} 유심 혜택을 확인한 다음 받았어요." },
  { group: "low", text: "{when}{ch}으로 마지막 문장까지 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}혼자 봐도 이해가 돼서 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 페이지와 상담이 같아서 {ch}으로 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 받을 수 있다고 적힌 걸 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}질문 하나에 답이 와서 {ch}에서 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{ch}으로 용어를 쉽게 듣고 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}예시가 제 경우와 같아서 {ch}에서 {amt} 유심 혜택을 확인한 다음 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택을 놓칠 뻔했다가 {ch}으로 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 공유된 화면과 같은지 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}적어 둔 메모와 같아서 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 기간이 맞는지 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}이름만 맞으면 된다길래 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택이 본문에 분명해서 {ch}으로 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{ch}에서 첫 문장부터 혜택이라고 해서 유심 혜택을 확인하고 {amt} 받았어요." },
  { group: "low", text: "{when}제목이 혜택이라 {ch}에서 {amt} 유심 혜택 본문을 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}으로 따라 하기 쉬워서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}두 설명이 같아서 {ch}에서 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 상담이 보충 설명이라 {ch}으로 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 화면만으로 충분하다고 해서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}나중에 다시 봐도 같아서 {ch}에서 {amt} 유심 혜택을 확인한 다음 받았어요." },
  { group: "low", text: "{when}{ch}으로 보낸 질문에 답이 맞아 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}애매하던 부분이 풀려서 {ch}에서 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택이 최종 안내와 같아서 {ch}으로 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 원하던 안내가 맞아서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}부연이 없어도 알겠기에 {ch}에서 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}{ch}으로 숫자와 문장을 같이 확인하고 {amt} 유심 혜택을 받았어요." },
  { group: "low", text: "{when}받을 수 있다고 적혀 있어서 {ch}에서 {amt} 유심 혜택을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 상담 창이 편해서 {ch}으로 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 답이 글로 남아서 {amt} 유심 혜택을 다시 확인하고 받았어요." },
  { group: "low", text: "{when}설명 듣고 이해가 돼서 {ch}에서 {amt} 유심 혜택을 확인한 다음 받았어요." },
  { group: "low", text: "{when}{ch}으로 페이지를 먼저 보고 {amt} 유심 혜택을 확인한 뒤 받았어요." },
  { group: "low", text: "{when}혼선이 없어서 {ch}에서 {amt} 유심 혜택 금액을 확인하고 받았어요." },
  { group: "low", text: "{when}{amt} 유심 혜택 조건이 그대로 유지돼서 {ch}으로 확인하고 받았어요." },
  { group: "low", text: "{when}{ch}에서 필요하던 안내를 확인하고 {amt} 유심 혜택을 받았어요." },

  // --- caps: 22만원 / 66만원. Amount is never empty. ---
  { group: "high", text: "{when}{ch}에서 최대 {amt}까지 된다고 해서 유심 혜택을 확인하고 안내대로 받았어요." },
  { group: "high", text: "{when}최대 {amt}까지 가능하다길래 {ch}으로 유심 혜택을 확인한 뒤 안내대로 받았어요." },
  { group: "high", text: "{when}상담에서 최대 {amt}까지라고 해서 {ch}에서 유심 혜택을 확인하고 받았어요." },
  { group: "high", text: "{when}{ch}에서 상한이 {amt}까지라고 해서 유심 혜택을 확인해 보고 받았어요." },
  { group: "high", text: "{when}글에는 최대 {amt}까지라고 적혀 있어서 {ch}으로 유심 혜택을 확인하고 받았어요." },
  { group: "high", text: "{when}{ch}에서 들은 한도가 {amt}까지라서 유심 혜택을 확인한 뒤 안내대로 받았어요." },
  { group: "high", text: "{when}저는 {amt}까지는 된다고 보고 {ch}에서 유심 혜택을 확인한 다음 받았어요." },
  { group: "high", text: "{when}{amt}까지 가능하다는 말을 {ch}에서 듣고 유심 혜택을 직접 확인한 뒤 받았어요." },
  { group: "high", text: "{when}{ch}으로 금액 안내를 받고 최대 {amt}까지인 유심 혜택을 확인한 뒤 받았어요." },
  { group: "high", text: "{when}필요한 만큼이 {amt} 안쪽이라 {ch}에서 유심 혜택을 확인하고 받았어요." },
  { group: "high", text: "{when}{ch}에서 다시 물어보니 최대 {amt}까지라고 해서 유심 혜택을 확인하고 받았어요." },
  { group: "high", text: "{when}안내 문장에 최대 {amt}까지라고 되어 있어서 {ch}으로 유심 혜택을 확인하고 받았어요." },
  { group: "high", text: "{when}{ch}에서 상한 {amt}을 확인하고 유심 혜택을 그 범위에서 받았어요." },
  { group: "high", text: "{when}{amt}까지 안내와 같아서 {ch}에서 유심 혜택을 확인한 뒤 받았어요." },
  { group: "high", text: "{when}{ch}으로 최대 {amt}까지 가능한지 확인하고 유심 혜택을 안내대로 받았어요." },
  { group: "high", text: "3일 지나고 들어왔어요. {when}{ch}에서 최대 {amt}까지라는 유심 혜택을 확인하고 받았어요." },
  { group: "high", text: "{when}상담 때 최대 {amt}까지 듣고 {ch}으로 유심 혜택을 확인한 다음 받았어요." },
  { group: "high", text: "{when}{ch}에서 {amt}까지 된다고 해서 진행했고 유심 혜택을 확인한 내용대로 받았어요." },

  // --- 3 cases. No won amount in the slot. ---
  { group: "count", text: "{when}최대 3건까지 된다고 해서 {ch}에서 유심 혜택을 확인하고 두 건만 받았어요." },
  { group: "count", text: "{when}{ch}에서 최대 3건까지 가능하다고 해서 유심 혜택을 확인한 뒤 두 건만 받았어요." },
  { group: "count", text: "{when}유심 혜택이 최대 3건까지라서 {ch}으로 확인하고 두 건만 받았어요." },
  { group: "count", text: "{when}{ch}으로 안내를 듣고 최대 3건까지인 유심 혜택을 확인한 다음 두 건만 받았어요." },
  { group: "count", text: "{when}한꺼번에 하지 않고 {ch}에서 유심 혜택을 확인한 뒤 최대 3건 중 두 건만 받았어요." },
  { group: "count", text: "{when}{ch}에서 3건까지 된다고 해서 유심 혜택인지 먼저 확인하고 두 건만 받았어요." },
  { group: "count", text: "{when}상담에서 최대 3건이라고 해서 {ch}으로 유심 혜택을 확인하고 두 건만 받았어요." },
  { group: "count", text: "{when}{ch}에서 조건을 들으니 최대 3건까지라서 유심 혜택을 확인한 뒤 두 건만 받았어요." },
  { group: "count", text: "{when}저는 최대 3건이 다 필요하지는 않아서 {ch}에서 유심 혜택을 확인하고 두 건만 받았어요." },
  { group: "count", text: "{when}{ch}으로 물어보고 최대 3건까지인 걸 확인한 뒤 유심 혜택을 두 건만 받았어요." },
  { group: "count", text: "{when}유심 혜택 안내가 최대 3건까지라서 {ch}에서 확인하고 이번엔 두 건만 받았어요." },
  { group: "count", text: "{when}{ch}에서 횟수를 확인해 보니 최대 3건까지라 유심 혜택을 두 건만 받았어요." },
  { group: "count", text: "{when}필요한 횟수만 하자고 하고 {ch}에서 유심 혜택이 최대 3건까지인지 확인한 뒤 두 건만 받았어요." },
  { group: "count", text: "{when}{ch}으로 안내받은 최대 건수가 3건이라 유심 혜택을 확인하고 두 건만 받았어요." },
  { group: "count", text: "{when}여유 있게 하자고 {ch}에서 유심 혜택을 확인했는데 최대 3건까지라서 두 건만 받았어요." },
  { group: "count", text: "{when}{ch}에서 최대 3건이라는 유심 혜택 안내를 확인하고 두 건만 받았어요." },
  { group: "count", text: "3일 지나고 들어왔어요. {when}{ch}에서 유심 혜택이 최대 3건까지인지 확인하고 두 건만 받았어요." },
  { group: "count", text: "{when}전부 받지 않고 {ch}으로 유심 혜택을 확인한 뒤 최대 3건 중 두 건만 받았어요." }
];

function amountsFor(group) {
  if (group === "high") return AMT_HIGH;
  if (group === "count") return [""];
  return AMT_LOW;
}

function fill(template, when, ch, amt) {
  return template
    .replaceAll("{when}", when)
    .replaceAll("{ch}", ch)
    .replaceAll("{amt}", amt)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.!?])/g, "$1")
    .trim();
}

function toPolite(text) {
  let value = text;
  for (const [from, to] of SPEECH) value = value.replaceAll(from, to);
  return value;
}

function isFormalIndex(i) {
  const mod = (i - 1) % 6;
  return mod === 3 || mod === 4 || mod === 5;
}

function rejectReason(casual) {
  if (BANNED_RE.test(casual)) return "forbidden";
  if (!casual.includes("유심 혜택")) return "benefit";
  if (!casual.includes("확인")) return "check";
  if (!/받았/.test(casual)) return "receive";
  if ((casual.match(/[.!?]/g) || []).length > 2) return "sentences";
  if (/\d+\s*분|요일|\d{1,2}\s*월/.test(casual)) return "date";
  if (casual.length < 40 || casual.length > 100) return `len ${casual.length}`;
  const formal = toPolite(casual);
  if (/어요|아요|예요|네요|해요/.test(formal)) return "formal-ending-left";
  if (!/(습니다|였습니다|하였습니다|입니다)[.!?]?$/.test(formal)) return "formal-end";
  if (formal.length < 40 || formal.length > 110) return `formal-len ${formal.length}`;
  if (BANNED_RE.test(formal)) return "forbidden-formal";
  return "";
}

function expandTemplate(entry) {
  const amounts = amountsFor(entry.group);
  const out = [];
  for (const when of WHEN) {
    for (const ch of CHANNELS) {
      for (const amt of amounts) {
        const casual = fill(entry.text, when, ch, amt);
        const reason = rejectReason(casual);
        if (reason) continue;
        out.push(casual);
      }
    }
  }
  return out;
}

function buildCasualBodies() {
  if (TEMPLATES.length < 120) {
    throw new Error(`need at least 120 templates, got ${TEMPLATES.length}`);
  }
  const seenTemplate = new Set();
  for (const entry of TEMPLATES) {
    if (seenTemplate.has(entry.text)) throw new Error(`duplicate template: ${entry.text}`);
    seenTemplate.add(entry.text);
    if (!entry.text.includes("{when}") || !entry.text.includes("{ch}")) {
      throw new Error(`template missing a safe slot: ${entry.text}`);
    }
    if (entry.group !== "count" && !entry.text.includes("{amt}")) {
      throw new Error(`template missing amount slot: ${entry.text}`);
    }
    if (/확인후|조건이 짧|사업자금|읽다|열다|찾다|묻다/.test(entry.text)) {
      throw new Error(`template contains a forbidden stem: ${entry.text}`);
    }
  }
  const buckets = TEMPLATES.map((entry) => expandTemplate(entry));
  const empty = buckets
    .map((list, index) => (list.length ? -1 : index))
    .filter((index) => index >= 0);
  if (empty.length) {
    const lines = empty.map((index) => {
      const sample = TEMPLATES[index];
      const amounts = amountsFor(sample.group);
      const probe = fill(sample.text, "아침에 ", "텔레그램", amounts[amounts.length - 1] || "");
      return `${index} ${rejectReason(probe) || "ok"} ${probe.length}: ${probe}`;
    });
    throw new Error(`templates with no bodies:\n${lines.join("\n")}`);
  }
  const selected = [];
  const seen = new Set();
  const used = new Set();
  let round = 0;
  while (selected.length < 10_000) {
    let progressed = false;
    for (let index = 0; index < buckets.length; index += 1) {
      const list = buckets[index];
      if (round >= list.length) continue;
      progressed = true;
      const casual = list[round];
      if (seen.has(casual)) continue;
      seen.add(casual);
      selected.push(casual);
      used.add(index);
      if (selected.length === 10_000) break;
    }
    if (!progressed) break;
    round += 1;
  }
  if (selected.length !== 10_000) {
    throw new Error(`filled ${selected.length} reviews from ${TEMPLATES.length} templates`);
  }
  if (used.size < 120) throw new Error(`only ${used.size} templates used`);
  return selected;
}

const CASUAL_BODIES = buildCasualBodies();

function toneBody(casual, i) {
  const formal = isFormalIndex(i);
  let text = formal ? toPolite(casual) : casual;
  if (!formal && i % 5 === 0 && text.length <= 88) text = `${text} 🙂`;
  return text;
}

const FINAL_BODIES = CASUAL_BODIES.map((casual, index) => toneBody(casual, index + 1));

function assertCorpus(bodies) {
  const seen = new Set();
  const counts = {
    "5만원": 0,
    "7만원": 0,
    "10만원": 0,
    "22만원": 0,
    "66만원": 0,
    "3건": 0,
    none: 0,
    polite: 0,
    emoji: 0,
    short: 0,
    mid: 0
  };
  let sleep = 0;
  for (const body of bodies) {
    if (seen.has(body)) throw new Error(`duplicate final body: ${body}`);
    seen.add(body);
    if (BANNED_RE.test(body)) throw new Error(`banned body: ${body}`);
    if (body.length < 40 || body.length >= 120) throw new Error(`length ${body.length}: ${body}`);
    if (body.length < 80) counts.short += 1;
    if (body.length <= 90) counts.mid += 1;
    if (/잠자고/.test(body)) sleep += 1;
    if (body.includes("🙂")) counts.emoji += 1;
    if (/(습니다|였습니다|하였습니다|입니다)[.!?]?$/.test(body)) counts.polite += 1;
    const hasWon = /5만원|7만원|10만원|22만원|66만원/.test(body);
    const hasCount = body.includes("3건");
    if (!hasWon && !hasCount) counts.none += 1;
    if (body.includes("5만원")) counts["5만원"] += 1;
    if (body.includes("7만원")) counts["7만원"] += 1;
    if (body.includes("10만원")) counts["10만원"] += 1;
    if (body.includes("22만원")) counts["22만원"] += 1;
    if (body.includes("66만원")) counts["66만원"] += 1;
    if (hasCount) counts["3건"] += 1;
  }
  if (sleep > 1) throw new Error(`잠자고 있던 used ${sleep} times`);
  if (counts.none < 1200) throw new Error(`only ${counts.none} reviews omit an amount`);
  if (counts.mid < 9000) throw new Error(`only ${counts.mid} reviews are <= 90 chars`);
  if (counts.short < 1) throw new Error("expected some reviews under 80 chars");
  if (counts.emoji < 100 || counts.emoji > 4900) throw new Error(`emoji count ${counts.emoji}`);
  if (counts.polite < 4000) throw new Error(`formal count ${counts.polite}`);
  for (const key of ["5만원", "7만원", "10만원", "22만원", "66만원", "3건"]) {
    if (counts[key] < 50) throw new Error(`${key} only appears ${counts[key]} times`);
  }
}

assertCorpus(FINAL_BODIES);

export function reviewTemplateCount() {
  return TEMPLATES.length;
}

export function bannedReviewPattern() {
  return BANNED_RE;
}

/**
 * @param {{ i: number, formal?: boolean }} input
 */
export function humanReviewBody({ i, formal }) {
  if (!Number.isInteger(i) || i < 1 || i > FINAL_BODIES.length) {
    throw new Error(`bad review index ${i}`);
  }
  const expected = isFormalIndex(i);
  if (typeof formal === "boolean" && formal !== expected) {
    throw new Error(`row ${i} formal flag does not match the age bucket`);
  }
  return FINAL_BODIES[i - 1];
}
