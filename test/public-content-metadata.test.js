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
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
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

test("uses safe defaults when CMS content is unavailable", async () => {
  const { onRequest } = await import("../functions/index.js");
  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = TestHTMLRewriter;
  try {
    const response = await onRequest({ request: new Request("https://climekr.com/"), env: {}, next: async () => new Response(page) });
    assert.match(await response.text(), /<title>클라임유심 \| 유심 개통 가능하면 최대 51만원<\/title>/);
  } finally {
    if (previous === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = previous;
  }
});
