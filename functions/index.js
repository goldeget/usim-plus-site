import { loadPublicContent } from "./api/content.js";
import { renderParagraphs } from "./_lib/copy-renderer.js";
import { SERVICE_FACTS } from "./_lib/service-facts.js";

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Splits a sentence into phrase parts at ", " (outside parentheses) so mobile CSS can break there.
function structuredIntroHtml(value, content) { return renderParagraphs(expandTokens(value, content)); }

function multilineHtml(value, content) {
  return expandTokens(value, content)
    .replaceAll("\\n", "\n")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");
}


function buildStructuredData(content, meta) {
  const organizationId = "https://climekr.com/#organization";
  const websiteId = "https://climekr.com/#website";
  const pageId = "https://climekr.com/#webpage";
  const serviceId = "https://climekr.com/#service";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "클라임유심 · USIM PLUS",
        alternateName: ["클라임유심", "CLIME", "climekr", "climekr 유심", "USIM PLUS"],
        legalName: content.operator.company,
        taxID: content.operator.registrationNumber,
        identifier: {
          "@type": "PropertyValue",
          propertyID: "통신판매업신고",
          value: content.operator.salesRegistration
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: content.operator.address,
          addressCountry: "KR"
        },
        faxNumber: content.operator.fax,
        sameAs: ["https://blog.naver.com/climeusimguide"],
        subjectOf: {
          "@type": "AboutPage",
          "@id": "https://climekr.com/about/#webpage",
          url: "https://climekr.com/about/",
          name: "CLIME 소개 | 클라임유심 · 유심 개통 혜택"
        },
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
        name: "클라임유심 유심 혜택 확인",
        serviceType: "유심 혜택 확인·진행 지원 플랫폼",
        provider: { "@id": organizationId },
        areaServed: { "@type": "Country", name: "대한민국" },
        availableLanguage: "Korean",
        description: SERVICE_FACTS.definition
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

async function currentContent(env) { return loadPublicContent(env); }

function cacheable(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=0, s-maxage=15");
  headers.delete("Content-Length");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function rootCacheKey(request) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return new Request(url, { method: "GET" });
}

export async function onRequest(context) {
  const isGet = context.request.method === "GET";
  const cache = isGet ? globalThis.caches?.default : null;
  const key = rootCacheKey(context.request);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return hit;
    } catch {}
  }
  const response = await context.next();
  if (!isGet) return response;
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return response;
  const { content, contentSource } = await currentContent(context.env);
  const metadata = buildPublicMetadata(content);
  const Rewriter = globalThis.HTMLRewriter;
  if (typeof Rewriter !== "function") return response;
  let rewriter = new Rewriter();
  for (const key of ["telegram", "channeltalk"]) {
    const fallback = key === "telegram" ? "https://t.me/climeusim" : "https://climeusim.channel.io";
    rewriter = rewriter.on(`[data-contact="${key}"]`, { element(element) { element.setAttribute("href", content.supportLinks[key] || fallback); } });
  }
  for (const id of ["eligibilityButton", "contactLookupLink"]) {
    rewriter = rewriter.on(`#${id}`, { element(element) { element.setAttribute("href", content.lookup.url); } });
  }
  const result = cacheable(await rewriter
    .on("#hero-title", { element(element) { element.setInnerContent(multilineHtml(content.headline, content), { html: true }); } })
    .on("#footerTerms", { element(element) { element.setInnerContent(expandTokens(content.copy.footerTerms, content)); } })
    .on("#contact-title", { element(element) { element.setInnerContent(expandTokens(content.copy.contactTitle, content)); } })
    .on("#contactIntro", { element(element) { element.setInnerContent(multilineHtml(content.copy.contactIntro, content), { html: true }); } })
    .on("#contactLookupLabel", { element(element) { element.setInnerContent(`${content.copy.contactLookupLabel} ↗`); } })
    .on("#eligibilityButton", { element(element) { element.setInnerContent(`${escapeHtml(content.lookup.label)} <span aria-hidden="true">↗</span>`, { html: true }); } })
    .on("title", { element(element) { element.setInnerContent(metadata.title); } })
    .on('meta[name="description"]', { element(element) { element.setAttribute("content", metadata.description); } })
    .on('meta[property="og:title"]', { element(element) { element.setAttribute("content", metadata.socialTitle); } })
    .on('meta[property="og:description"]', { element(element) { element.setAttribute("content", metadata.socialDescription); } })
    .on('meta[name="twitter:title"]', { element(element) { element.setAttribute("content", metadata.socialTitle); } })
    .on('meta[name="twitter:description"]', { element(element) { element.setAttribute("content", metadata.socialDescription); } })
    .on('script[type="application/ld+json"]', { element(element) { element.setInnerContent(jsonLdEscape(metadata.structuredData), { html: true }); } })
    .on("[data-content-source]", { element(element) { element.setInnerContent(contentSource === "cms" ? "현재 저장된 운영 안내 기준" : "기본 안내 기준 · 현재 조건은 공식 상담에서 확인하세요"); } })
    .on("[data-service-definition]", { element(element) { element.setInnerContent(SERVICE_FACTS.definition); } })
    .on("#homeIntro", { element(element) { element.setInnerContent(structuredIntroHtml(content.intro, content), { html: true }); } })
    .on("#operatorCompany", { element(element) { element.setInnerContent(content.operator.company); } })
    .on("#operatorRepresentative", { element(element) { element.setInnerContent(content.operator.representative); } })
    .on("#operatorRepresentativeLabel", { element(element) { element.setInnerContent(content.copy.operatorRepresentativeLabel); } })
    .on("#operatorRegistrationNumber", { element(element) { element.setInnerContent(content.operator.registrationNumber); } })
    .on("#operatorSalesRegistration", { element(element) { element.setInnerContent(content.operator.salesRegistration); } })
    .on("#operatorAddress", { element(element) { element.setInnerContent(content.operator.address); } })
    .on("#operatorFax", { element(element) { element.setInnerContent(content.operator.fax); } })
    .on("#operatorEmail", { element(element) { element.setInnerContent(content.operator.email); } })
    .on("#operatorEmailLink", { element(element) { element.setAttribute("href", `mailto:${content.operator.email}`); } })
    .transform(response));
  if (cache) {
    const put = cache.put(key, result.clone()).catch(() => {});
    if (typeof context.waitUntil === "function") context.waitUntil(put);
    else await put;
  }
  return result;
}
