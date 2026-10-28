import { DEFAULT_CONTENT, validateContent } from "../api/content.js";

function currency(amount) {
  return Number.isInteger(amount) && amount >= 0 && amount % 10000 === 0
    ? `${amount / 10000}만원`
    : `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

async function loadPayout(env) {
  if (!env.CONTENT_DB) return DEFAULT_CONTENT.payout;
  try {
    const row = await env.CONTENT_DB.prepare("SELECT content FROM site_content WHERE id = ?").bind("home").first();
    if (!row?.content) return DEFAULT_CONTENT.payout;
    const content = JSON.parse(row.content);
    if (content.schemaVersion !== 4 || validateContent(content)) return DEFAULT_CONTENT.payout;
    return content.payout;
  } catch {
    return DEFAULT_CONTENT.payout;
  }
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "GET") return context.next();
  const response = await context.next();
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return response;
  if (typeof globalThis.HTMLRewriter !== "function") return response;

  const payout = await loadPayout(context.env || {});
  const perCase = payout.milestones.reduce((sum, stage) => sum + stage.amount, 0);
  const maxTotal = perCase * payout.maxCases;
  // Only validated integers are inserted into HTML. There is no user-controlled markup.
  const rows = payout.milestones.map(stage =>
    `<div class="row"><span>${stage.days}일 유지 단계</span><strong>${currency(stage.amount)} 지급 대상</strong></div>`
  ).join("") +
    `<div class="row"><span>1건 전체 조건 충족<span class="only-pc"> · </span><br class="mo">최대 ${payout.maxCases}건</span><strong><em>${currency(perCase)} / 건</em></strong></div>`;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=0, s-maxage=15");
  headers.delete("Content-Length");
  return new globalThis.HTMLRewriter()
    .on("[data-total]", { element(element) { element.setInnerContent(currency(maxTotal)); } })
    .on("[data-milestones]", { element(element) { element.setInnerContent(rows, { html: true }); } })
    .transform(new Response(response.body, { status: response.status, headers }));
}
