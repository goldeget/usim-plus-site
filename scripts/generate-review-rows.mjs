/** Deterministic unique Korean review rows for import (no duplicate bodies). */
const openings = [
  "채널톡으로 상담 받고",
  "텔레그램으로 문의한 뒤",
  "조회 캡처 보내고",
  "개통 가능 여부 확인 후",
  "안내 받은 순서대로 진행했는데",
  "처음엔 반신반의했지만",
  "주변 추천으로 알게 됐고",
  "홈페이지 보고 연락했는데"
];
const middles = [
  "조건 설명이 길지 않아서 이해하기 수월했습니다.",
  "유지 기간별 지급 안내를 다시 확인했습니다.",
  "대출이 아니라는 설명을 먼저 듣고 결정했습니다.",
  "개통·통신 비용 부담 범위를 상담에서 짚어 주었습니다.",
  "사진 보내는 방법이 단순해서 따라 하기 편했습니다.",
  "상담 답변이 늦지 않아 진행 상황을 알 수 있었습니다.",
  "조회 사이트 이동부터 상담까지 흐름이 이어졌습니다.",
  "유지 조건 충족 여부를 단계별로 안내받았습니다."
];
const closings = [
  "급하게 필요했지만 조건을 먼저 본 뒤 참여했습니다.",
  "당일 지급은 아니라는 점은 미리 알고 시작했습니다.",
  "본인 명의 회선 책임은 본인에게 있다는 설명도 들었습니다.",
  "다음 단계 안내를 같은 상담창에서 받아 편했습니다.",
  "궁금한 점을 다시 물어도 친절히 답변해 주었습니다.",
  "절차가 복잡해 보였지만 실제로는 순서대로 하면 됐습니다.",
  "조건에 맞춰 진행 중이며 안내는 계속 받고 있습니다.",
  "비용 부담 범위를 서면·대화로 다시 확인했습니다."
];
const names = ["kim", "lee", "park", "choi", "jung", "han", "yoon", "jang", "lim", "seo"];
const regions = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원"];
const channels = ["channeltalk", "telegram"];
const stages = ["3", "15", "30", "consult"];

function ratingForIndex(i) {
  const r = i % 100;
  if (r < 52) return 5;
  if (r < 78) return 4;
  if (r < 90) return 3;
  if (r < 97) return 2;
  return 1;
}

export function generateReviewRows(count = 10_000) {
  const rows = [];
  const start = Date.UTC(2024, 2, 1);
  const span = Date.UTC(2026, 9, 1) - start;
  for (let i = 1; i <= count; i += 1) {
    const body = `${openings[i % openings.length]} ${middles[(i * 3) % middles.length]} ${closings[(i * 7) % closings.length]} (후기-${String(i).padStart(5, "0")})`;
    const t = new Date(start + (span * i) / count);
    rows.push({
      rowId: `corpus-${String(i).padStart(5, "0")}`,
      publishedAt: t.toISOString(),
      rating: ratingForIndex(i),
      displayName: `${names[i % names.length]}${String(1000 + (i % 9000)).slice(1)}***`,
      body,
      tags: {
        region: regions[i % regions.length],
        channel: channels[i % channels.length],
        stage: stages[i % stages.length]
      },
      featured: i <= 24 ? 1 : 0,
      sortBoost: i <= 24 ? 100 - i : 0
    });
  }
  return rows;
}
