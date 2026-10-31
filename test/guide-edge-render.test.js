import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/guide/index.js";
import { DEFAULT_CONTENT } from "../functions/api/content.js";

class Rewriter {
  rules = [];
  on(selector, handlers) { this.rules.push([selector, handlers]); return this; }
  async transform(response) {
    let html = await response.text();
    for (const [selector, handlers] of this.rules) {
      if (selector === "[data-total]") {
        html = html.replace(/<strong data-total[^>]*>[\s\S]*?<\/strong>/, tag => {
          let value = "";
          handlers.element({ setInnerContent(s) { value = s; } });
          return tag.replace(/>[\s\S]*<\/strong>$/, `>${value}</strong>`);
        });
      }
      if (selector === "[data-milestones]") {
        html = html.replace(/<div class="rows" data-milestones[^>]*>[\s\S]*?<\/div>\s*<p class="micro"/, tag => {
          let value = "";
          handlers.element({ setInnerContent(s) { value = s; } });
          return tag.replace(/>[\s\S]*<\/div>\s*<p class="micro"$/, `>${value}</div>\n      <p class="micro"`);
        });
      }
    }
    return new Response(html, { headers: response.headers });
  }
}

const html = `<html><strong data-total>최신 조건 확인 중</strong><div class="rows" data-milestones>조건 확인 중</div><p class="micro">상담</p></html>`;
const next = () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

test("server-rendered guide provides current CMS payouts to crawlers without client JS", async () => {
  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = Rewriter;
  try {
    const content = structuredClone(DEFAULT_CONTENT);
    const env = { CONTENT_DB: { prepare() { return { bind() { return { first: async () => ({ content: JSON.stringify(content) }) }; } }; } } };
    const response = await onRequest({ request: new Request("https://climekr.com/guide/"), env, next });
    const result = await response.text();
    assert.equal(response.headers.get("cache-control"), "public, max-age=0, s-maxage=15");
    assert.match(result, /<strong data-total>66만원<\/strong>/);
    assert.match(result, /3일 유지 단계/);
    assert.match(result, /15일 유지 단계/);
    assert.match(result, /30일 유지 단계/);
    assert.match(result, /22만원 \/ 건/);
  } finally {
    if (previous === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = previous;
  }
});

test("guide passes through HTML when the runtime has no HTMLRewriter", async () => {
  const previous = globalThis.HTMLRewriter;
  delete globalThis.HTMLRewriter;
  try {
    const response = await onRequest({ request: new Request("https://climekr.com/guide/"), env: {}, next });
    assert.equal(await response.text(), html);
  } finally {
    if (previous !== undefined) globalThis.HTMLRewriter = previous;
  }
});

test('guide client updates payouts even when optional channel links are empty', async () => {
 const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');
 const page=await readFile(new URL('../public/guide/index.html',import.meta.url),'utf8');
 const source=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
 const content=structuredClone(DEFAULT_CONTENT);content.payout.maxCases=2;
 const nodes={'[data-total]':{textContent:''},'[data-milestones]':{children:[],replaceChildren(){this.children=[];},append(node){this.children.push(node);}}};
 const document={querySelector:s=>nodes[s],querySelectorAll:()=>[],createElement:tag=>({tag,children:[],append(...children){this.children.push(...children);}})};
 await vm.runInNewContext(source,{document,URL,Intl,fetch:async()=>({ok:true,json:async()=>content})});
 assert.equal(nodes['[data-total]'].textContent,'440,000원');assert.equal(nodes['[data-milestones]'].children.length,4);
});
