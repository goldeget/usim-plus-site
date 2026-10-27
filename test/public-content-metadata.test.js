import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DEFAULT_CONTENT } from "../functions/api/content.js";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function readAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=(['"])(.*?)\\1`))?.[2] ?? null;
}

function setAttribute(tag, name, value) {
  const escaped = escapeAttribute(value);
  const matcher = new RegExp(`(\\b${name}=)(['"])(.*?)\\2`);
  return matcher.test(tag) ? tag.replace(matcher, `$1"${escaped}"`) : tag.replace(/\s*\/?\s*>$/, ` ${name}="${escaped}">`);
}

class TestHTMLRewriter {
  rules = [];
  on(selector, handlers) { this.rules.push({ selector, handlers }); return this; }
  async transform(response) {
    let html = await response.text();
    for (const { selector, handlers } of this.rules) {
      if (selector === "title") {
        html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, tag => {
          let value = "";
          handlers.element({ setInnerContent(next) { value = next; } });
          return `<title>${escapeAttribute(value)}</title>`;
        });
      } else if (selector.startsWith("meta[")) {
        const [, key, value] = selector.match(/meta\[(name|property)="([^"]+)"\]/);
        html = html.replace(/<meta\b[^>]*>/gi, tag => {
          if (readAttribute(tag, key) !== value) return tag;
          let nextTag = tag;
          handlers.element({ setAttribute(name, next) { nextTag = setAttribute(nextTag, name, next); } });
          return nextTag;
        });
      } else if (selector === 'script[type="application/ld+json"]') {
        html = html.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/i, tag => {
          let value = "";
          handlers.element({ setInnerContent(next) { value = next; } });
          return tag.replace(/>[\s\S]*<\/script>$/i, `>${value}</script>`);
        });
      } else if (selector.startsWith("#")) {
        const id = selector.slice(1);
        html = html.replace(new RegExp(`(<(p|span|a|div|h[1-6]|li|strong|small|em|button)\\b[^>]*\\bid="${id}"[^>]*>)([\\s\\S]*?)(</\\2>)`, "i"), (all, open, tag, inner, close) => {
          let nextOpen = open;
          let value = inner;
          let asHtml = false;
          let changedContent = false;
          handlers.element({
            setAttribute(name, next) { nextOpen = setAttribute(nextOpen, name, next); },
            setInnerContent(next, options) {
              value = next;
              asHtml = Boolean(options && options.html);
              changedContent = true;
            }
          });
          return `${nextOpen}${changedContent && !asHtml ? escapeAttribute(value) : value}${close}`;
        });
      }
    }
    return new Response(html, { status: response.status, headers: response.headers });
  }
}

function createEnv(content) {
  return {
    CONTENT_DB: {
      prepare() { return { bind() { return { first: async () => ({ content: JSON.stringify(content) }) }; } }; }
    }
  };
}

test("serves edited title, social metadata and matching Organization/Service graph without FAQ schema", async () => {
  const { onRequest } = await import("../functions/index.js");
  const content = structuredClone(DEFAULT_CONTENT);
  content.payout.milestones = [{ days: 3, amount: 40000 }, { days: 15, amount: 20000 }, { days: 30, amount: 30000 }];
  content.payout.maxCases = 2;
  content.seo.title = "{{MAX_TOTAL}} 지급 안내 | climekr";
  content.seo.description = "검색 설명 {{MAX_TOTAL}}";
  content.seo.socialTitle = "공유 제목 {{MAX_TOTAL}}";
  content.seo.socialDescription = "공유 설명 {{MAX_PER_CASE}}";
  content.faqs[0] = { question: "새 질문", answer: "새 답변" };
  content.operator = {
    company: "테스트 & 법인㈜",
    representative: "테스트 대표",
    registrationNumber: "123-45-67890",
    salesRegistration: "제2026-서울영등포-0001호",
    address: "서울시 영등포구 테스트로 1 <별관>",
    fax: "02-1234-5678",
    email: "contact@example.com"
  };

  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = TestHTMLRewriter;
  try {
    const response = await onRequest({
      request: new Request("https://climekr.com/"),
      env: createEnv(content),
      next: async () => new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    });
    const html = await response.text();
    assert.equal(response.headers.get("cache-control"), "public, max-age=0, s-maxage=15");
    assert.match(html, /<title>18만원 지급 안내 \| climekr<\/title>/);
    assert.match(html, /name="description"[^>]*content="검색 설명 18만원"/);
    assert.match(html, /property="og:title"[^>]*content="공유 제목 18만원"/);
    assert.match(html, /name="twitter:description"[^>]*content="공유 설명 9만원"/);
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    const graph = JSON.parse(json)["@graph"];
    assert.equal(graph.some(item => item["@type"] === "FAQPage"), false);
    assert.equal(graph.find(item => item["@type"] === "WebPage").name, "18만원 지급 안내 | climekr");
    assert.equal(graph.find(item => item["@type"] === "WebPage").description, "검색 설명 18만원");
    assert.equal(graph.find(item => item["@type"] === "Service").description, "검색 설명 18만원");
    const organization = graph.find(item => item["@type"] === "Organization");
    assert.equal(organization.legalName, content.operator.company);
    assert.equal(organization.email, content.operator.email);
    assert.equal(organization.taxID, content.operator.registrationNumber);
    assert.equal(organization.identifier.value, content.operator.salesRegistration);
    assert.equal(organization.address.streetAddress, content.operator.address);
    assert.equal(organization.faxNumber, content.operator.fax);
    for (const [id, key] of Object.entries({
      operatorCompany: "company", operatorRepresentative: "representative",
      operatorRegistrationNumber: "registrationNumber", operatorSalesRegistration: "salesRegistration",
      operatorAddress: "address", operatorFax: "fax", operatorEmail: "email"
    })) {
      assert.ok(html.includes(`id="${id}">${escapeAttribute(content.operator[key])}</span>`), id);
    }
    assert.match(html, /id="operatorEmailLink" href="mailto:contact@example\.com"><span id="operatorEmail">contact@example\.com<\/span>/);
    const intro = html.match(/id="homeIntro">([\s\S]*?)<\/p>/)?.[1].replace(/<\/?span[^>]*>/g, "") || "";
    assert.equal(intro.split("<br>").length, 5);
    assert.match(intro, /최대 18만원입니다\. 상담·신청 즉시 지급이 아닙니다\.<br>상담은 텔레그램·채널톡입니다\.$/);
    assert.doesNotMatch(intro, /\{\{MAX_TOTAL\}\}/);
  } finally {
    if (previous === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = previous;
  }
});

test("renders preserved v3 copy into raw metadata and matches the public content API upgrade", async () => {
  const { onRequest } = await import("../functions/index.js");
  const { onRequest: readContent } = await import("../functions/api/content.js");
  const legacy = {
    schemaVersion: 3,
    headline: "운영자가 저장한 기존 제목",
    intro: "기존 안내 문구",
    checklist: [
      { title: "1. 조회", body: "조회 내용을 확인합니다." },
      { title: "2. 상담", body: "조회 화면을 상담창으로 보냅니다." },
      { title: "3. 확인", body: "유지 조건을 확인합니다." }
    ],
    faqs: [{ question: "기존 운영자 질문은 남아 있나요?", answer: "기존 답변을 보존합니다." }],
    supportLinks: { telegram: "https://t.me/current", line: "", channeltalk: "" }
  };
  const env = createEnv(legacy);
  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = TestHTMLRewriter;
  try {
    const [pageResponse, apiResponse] = await Promise.all([
      onRequest({ request: new Request("https://climekr.com/"), env, next: async () => new Response(page, { headers: { "Content-Type": "text/html" } }) }),
      readContent({ request: new Request("https://climekr.com/api/content"), env })
    ]);
    const migrated = await apiResponse.json();
    const html = await pageResponse.text();
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    const graph = JSON.parse(json)["@graph"];
    assert.equal(graph.some(item => item["@type"] === "FAQPage"), false);
    assert.equal(graph.find(item => item["@type"] === "Organization").email, migrated.operator.email);
    assert.equal(graph.find(item => item["@type"] === "Service").serviceType, "본인 명의 회선(알뜰·선불) 조건부 혜택 안내");
  } finally {
    if (previous === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = previous;
  }
});

test("uses safe defaults when CMS content is unavailable", async () => {
  const { onRequest } = await import("../functions/index.js");
  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = TestHTMLRewriter;
  try {
    const response = await onRequest({ request: new Request("https://climekr.com/"), env: {}, next: async () => new Response(page) });
    assert.match(await response.text(), /<title>클라임유심 \| 유심 혜택 · 유심 혜택 확인 · 최대 66만원 \| 서울평가정보㈜<\/title>/);
  } finally {
    if (previous === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = previous;
  }
});

test("reuses the short-lived edge copy instead of querying D1 for every homepage view", async () => {
  const { onRequest } = await import("../functions/index.js");
  const content = structuredClone(DEFAULT_CONTENT);
  let queryCount = 0;
  const env = {
    CONTENT_DB: {
      prepare() { return { bind() { return { first: async () => { queryCount += 1; return { content: JSON.stringify(content) }; } }; } }; }
    }
  };
  const entries = new Map();
  const previousCaches = globalThis.caches;
  const previousRewriter = globalThis.HTMLRewriter;
  globalThis.caches = {
    default: {
      async match(key) { return entries.get(key.url)?.clone(); },
      async put(key, response) { entries.set(key.url, response.clone()); }
    }
  };
  globalThis.HTMLRewriter = TestHTMLRewriter;
  try {
    const head = await onRequest({
      request: new Request("https://climekr.com/?from=home", { method: "HEAD" }),
      env,
      next: async () => new Response(null, { headers: { "Content-Type": "text/html" } })
    });
    assert.equal(await head.text(), "");
    assert.equal(queryCount, 0);
    assert.equal(entries.size, 0, "a HEAD response must not poison the cached GET body");
    for (let visit = 0; visit < 2; visit += 1) {
      const response = await onRequest({ request: new Request("https://climekr.com/?from=home"), env, next: async () => new Response(page, { headers: { "Content-Type": "text/html" } }) });
      assert.match(await response.text(), /<title>/);
    }
    assert.equal(queryCount, 1);
    assert.equal(entries.size, 1);
  } finally {
    if (previousCaches === undefined) delete globalThis.caches;
    else globalThis.caches = previousCaches;
    if (previousRewriter === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = previousRewriter;
  }
});
