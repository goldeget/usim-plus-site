import { DEFAULT_CONTENT, fixedPrivacyCopy, validateContent } from "./api/content.js";

const jsonLdEscape = value => JSON.stringify(value)
  .replaceAll("<", "\\u003c")
  .replaceAll(">", "\\u003e")
  .replaceAll("&", "\\u0026");

function formatMoney(amount) {
  return Number.isInteger(amount) && amount >= 10000 && amount % 10000 === 0
    ? `${amount / 10000}만원`
    : `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

function expandTokens(value, content) {
  const perCase = content.payout.milestones.reduce((sum, item) => sum + item.amount, 0);
  const tokens = {
    MAX_TOTAL: formatMoney(perCase * content.payout.maxCases),
    MAX_PER_CASE: formatMoney(perCase),
    MAX_CASES: String(content.payout.maxCases),
    EMAIL: content.operator.email,
    LOOKUP_LABEL: content.lookup.label
  };
  content.payout.milestones.forEach((item, index) => {
    tokens[`DAYS_${index + 1}`] = String(item.days);
    tokens[`AMOUNT_${index + 1}`] = formatMoney(item.amount);
  });
  return String(value || "").replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => Object.hasOwn(tokens, key) ? tokens[key] : match);
}

function payoutFaq(content) {
  const stages = content.payout.milestones.map((item, index) => `${item.days}일 유지 후 ${formatMoney(item.amount)}${index ? " 추가" : ""}`).join(", ");
  const perCase = content.payout.milestones.reduce((sum, item) => sum + item.amount, 0);
  return `각 유지 기간이 확인되면 단계별 지급 대상이 됩니다: ${stages}.\n한 사람 최대 ${content.payout.maxCases}건이며, 모든 조건을 충족하면 최대 ${formatMoney(perCase * content.payout.maxCases)}입니다.\n실제 지급 여부와 시점은 신청 내용과 유지 조건 확인 후 결정됩니다.`;
}

function buildStructuredData(content, meta) {
  const organizationId = "https://climekr.com/#organization";
  const websiteId = "https://climekr.com/#website";
  const pageId = "https://climekr.com/#webpage";
  const serviceId = "https://climekr.com/#service";
  const answer = item => item.key === "payoutSchedule" ? payoutFaq(content) : expandTokens(item.answer, content);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "클라임유심 · USIM PLUS",
        alternateName: ["클라임유심", "climekr 유심"],
        legalName: content.operator.company,
        url: "https://climekr.com/",
        email: content.operator.email,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: content.operator.email,
          availableLanguage: "Korean",
          areaServed: "KR"
        }
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: "https://climekr.com/",
        name: "클라임유심 · climekr · USIM PLUS",
        inLanguage: "ko-KR",
        publisher: { "@id": organizationId }
      },
      {
        "@type": "WebPage",
        "@id": pageId,
        url: "https://climekr.com/",
        name: meta.title,
        description: meta.description,
        inLanguage: "ko-KR",
        isPartOf: { "@id": websiteId },
        about: { "@id": serviceId }
      },
      {
        "@type": "Service",
        "@id": serviceId,
        name: "클라임유심 개통 혜택 참여",
        serviceType: "유심 개통 혜택 안내 및 상담 채널 연결",
        provider: { "@id": organizationId },
        areaServed: { "@type": "Country", name: "대한민국" },
        availableLanguage: "Korean",
        description: meta.description
      },
      {
        "@type": "FAQPage",
        "@id": "https://climekr.com/#faq",
        isPartOf: { "@id": pageId },
        mainEntity: content.faqs.map(item => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: answer(item) }
        }))
      }
    ]
  };
}

export function buildPublicMetadata(content) {
  const title = expandTokens(content.seo.title, content);
  const description = expandTokens(content.seo.description, content);
  const socialTitle = expandTokens(content.seo.socialTitle, content);
  const socialDescription = expandTokens(content.seo.socialDescription, content);
  return {
    title,
    description,
    socialTitle,
    socialDescription,
    structuredData: buildStructuredData(content, { title, description })
  };
}

async function currentContent(env) {
  if (!env.CONTENT_DB) return DEFAULT_CONTENT;
  try {
    const row = await env.CONTENT_DB.prepare("SELECT content FROM site_content WHERE id = ?").bind("home").first();
    if (!row) return DEFAULT_CONTENT;
    const stored = JSON.parse(row.content);
    return stored.schemaVersion === 4 && !validateContent(stored)
      ? { ...DEFAULT_CONTENT, ...stored, copy: { ...stored.copy, ...fixedPrivacyCopy() } }
      : DEFAULT_CONTENT;
  } catch {
    return DEFAULT_CONTENT;
  }
}

function noStore(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.delete("Content-Length");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context) {
  const response = await context.next();
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return response;
  const content = await currentContent(context.env);
  const metadata = buildPublicMetadata(content);
  const Rewriter = globalThis.HTMLRewriter;
  if (typeof Rewriter !== "function") return noStore(response);
  return noStore(await new Rewriter()
    .on("title", { element(element) { element.setInnerContent(metadata.title); } })
    .on('meta[name="description"]', { element(element) { element.setAttribute("content", metadata.description); } })
    .on('meta[property="og:title"]', { element(element) { element.setAttribute("content", metadata.socialTitle); } })
    .on('meta[property="og:description"]', { element(element) { element.setAttribute("content", metadata.socialDescription); } })
    .on('meta[name="twitter:title"]', { element(element) { element.setAttribute("content", metadata.socialTitle); } })
    .on('meta[name="twitter:description"]', { element(element) { element.setAttribute("content", metadata.socialDescription); } })
    .on('script[type="application/ld+json"]', { element(element) { element.setInnerContent(jsonLdEscape(metadata.structuredData), { html: true }); } })
    .transform(response));
}
