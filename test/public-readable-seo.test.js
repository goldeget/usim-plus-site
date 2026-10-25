import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../public/index.html");
const guide = read("../public/guide/index.html");
const links = read("../public/links/index.html");
const notFound = read("../public/404.html");
const css = read("../public/user-flow.css");
const aiText = read("../public/llms.txt");
const contentService = read("../functions/index.js");

test("all public pages use Korean language metadata and preserve meaningful text", () => {
  for(const [name, html] of [["home",home],["guide",guide],["links",links],["404",notFound]]) {
    assert.match(html, /<html lang="ko">/, name);
    assert.match(html, /<meta charset="utf-8"/, name);
    assert.match(html, /name="viewport"/, name);
  }
  const visible = home.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  assert.doesNotMatch(visible, /\\n/, "No literal backslash-n text in main visible markup");
  assert.match(visible, /고객의 유심 개통·통신·유지 관련 비용은 회사가 전액 부담합니다.\n개통 가능 여부를 확인하고 텔레그램·채널톡에서 조건을 문의하세요/);
});

test("public Korean multiline copy and mobile readable text use native line wrapping", () => {
  assert.match(css, /white-space:\s*pre-line;\s*line-height:\s*1\.85/);
  assert.match(css, /\.hero-intro,\.consultation-intro,\.section-intro,\.step p,\.legacy-help,\.site-footer__terms\{/);
  assert.match(css, /word-break:keep-all/);
  assert.match(css, /overflow-wrap:break-word/);
  assert.match(guide, /\.lead,\.notice,\.section-head,\.card p,\.micro,\.end p,footer\{word-break:keep-all/);
  assert.match(guide, /@media\(max-width:420px\)\{\.row\{flex-wrap:wrap/);
  assert.match(links, /\.subtitle,\.disclosure,\.detail,small\{word-break:keep-all/);
});

test("visible FAQs are removed on main and guide, and not re-created by JavaScript or schema", () => {
  assert.doesNotMatch(home, /<section class="faq"|id="faq-title"|faqList|faqSchema|FAQPage/);
  assert.doesNotMatch(guide, /<section class="faq"|id="faq-title"|FAQPage/);
  assert.doesNotMatch(contentService, /FAQPage/);
  assert.doesNotMatch(css, /\.faq(?:\s|\{|\-|\.)/);
  assert.doesNotMatch(aiText, /홈페이지 접수 상태 조회 및 FAQ/);
});

test("SEO retains original service information without fabricated ratings or bot directives", () => {
  const json = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json);
  const graph=JSON.parse(json)["@graph"];
  assert.deepEqual(graph.map(x=>x["@type"]), ["Organization","WebSite","WebPage","Service"]);
  assert.match(graph.find(x=>x["@type"]==="WebPage").description, /3일·15일·30일/);
  assert.match(graph.find(x=>x["@type"]==="Service").description, /대출이 아닌 유심 개통 혜택/);
  assert.doesNotMatch(json, /AggregateRating|"@type"\s*:\s*"Review"/);
  assert.match(guide, /rel="canonical" href="https:\/\/climekr\.com\/guide\/"/);
  assert.match(links, /name="robots" content="noindex,follow"/);
  assert.match(home, /rel="canonical" href="https:\/\/climekr\.com\/"/);
  assert.match(home, /id="payoutConditions"/);
  assert.match(home, /id="contact"/);
});
