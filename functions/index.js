import { DEFAULT_CONTENT, fixedPrivacyCopy, normalizeOperator, upgradedV3, validateContent, validateV3, withCurrentPublicSummary } from "./api/content.js";

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
function splitIntroParts(sentence) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < sentence.length; i++) {
    const ch = sentence[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0 && /\s/.test(sentence[i + 1] || "")) {
      parts.push(sentence.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  parts.push(sentence.slice(start).trim());
  return parts.filter(Boolean);
}

// Structured, escaped hero intro: lines (<br>) > sentence chunks > phrase parts.
// Desktop keeps it inline; mobile CSS turns chunks/parts into semantic block lines.
function structuredIntroHtml(value, content) {
  return expandTokens(value, content)
    .replaceAll("\\n", "\n")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/([.!?])\s+/g, "$1\u0000").split("\u0000")
      .map(sentence => `<span class="hero-intro__chunk">${splitIntroParts(sentence)
        .map(part => `<span class="hero-intro__part">${escapeHtml(part)}</span>`).join(" ")}</span>`)
      .join(" "))
    .join("<br>");
}

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
        founder: { "@type": "Person", name: content.operator.representative },
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
        serviceType: "본인 명의 회선(알뜰·선불) 조건부 혜택 안내",
        provider: { "@id": organizationId },
        areaServed: { "@type": "Country", name: "대한민국" },
        availableLanguage: "Korean",
        description: meta.description
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
    if (stored.schemaVersion === 4 && !validateContent(stored)) {
      return withCurrentPublicSummary({ ...DEFAULT_CONTENT, ...stored, operator: normalizeOperator(stored.operator), copy: { ...stored.copy, ...fixedPrivacyCopy() } });
    }
    if (stored.schemaVersion === 3 && !validateV3(stored)) return withCurrentPublicSummary(upgradedV3(stored));
    return DEFAULT_CONTENT;
  } catch {
    return DEFAULT_CONTENT;
  }
}

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
  const content = await currentContent(context.env);
  const metadata = buildPublicMetadata(content);
  const Rewriter = globalThis.HTMLRewriter;
  if (typeof Rewriter !== "function") return response;
  const result = cacheable(await new Rewriter()
    .on("title", { element(element) { element.setInnerContent(metadata.title); } })
    .on('meta[name="description"]', { element(element) { element.setAttribute("content", metadata.description); } })
    .on('meta[property="og:title"]', { element(element) { element.setAttribute("content", metadata.socialTitle); } })
    .on('meta[property="og:description"]', { element(element) { element.setAttribute("content", metadata.socialDescription); } })
    .on('meta[name="twitter:title"]', { element(element) { element.setAttribute("content", metadata.socialTitle); } })
    .on('meta[name="twitter:description"]', { element(element) { element.setAttribute("content", metadata.socialDescription); } })
    .on('script[type="application/ld+json"]', { element(element) { element.setInnerContent(jsonLdEscape(metadata.structuredData), { html: true }); } })
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
