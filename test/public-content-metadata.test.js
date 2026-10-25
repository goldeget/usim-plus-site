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

test("serves the edited title, search and social descriptions, and matching FAQ schema in raw HTML", async () => {
  const { onRequest } = await import("../functions/index.js");
  const content = structuredClone(DEFAULT_CONTENT);
  content.payout.milestones = [{ days: 3, amount: 40000 }, { days: 15, amount: 20000 }, { days: 30, amount: 30000 }];
  content.payout.maxCases = 2;
  content.seo.title = "{{MAX_TOTAL}} 지급 안내 | climekr";
  content.seo.description = "검색 설명 {{MAX_TOTAL}}";
  content.seo.socialTitle = "공유 제목 {{MAX_TOTAL}}";
  content.seo.socialDescription = "공유 설명 {{MAX_PER_CASE}}";
  content.faqs[0] = { question: "새 질문", answer: "새 답변" };

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
    const faq = graph.find(item => item["@type"] === "FAQPage");
    assert.equal(faq.mainEntity[0].name, "새 질문");
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, "새 답변");
    assert.match(faq.mainEntity.find(item => item.name.includes("지급 금액")).acceptedAnswer.text, /18만원/);
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
    const faq = JSON.parse(json)["@graph"].find(item => item["@type"] === "FAQPage");
    assert.equal(faq.mainEntity[0].name, migrated.faqs[0].question);
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, migrated.faqs[0].answer);
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
    assert.match(await response.text(), /<title>클라임유심 \| 유심 개통 가능하면 최대 66만원<\/title>/);
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
