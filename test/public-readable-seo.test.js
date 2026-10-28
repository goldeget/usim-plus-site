import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../public/index.html");
const guide = read("../public/guide/index.html");
const structure = read("../public/structure/index.html");
const about = read("../public/about/index.html");
const topicsCss = read("../public/topics/topics.css");
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
  assert.match(visible.replace(/<\/?span[^>]*>/g, ""), /몰랐던 유심 혜택으로 최대 66만원\.<br>3일·15일·30일 유지 확인 후 단계 지급 대상이 정해집니다\.<br>자세한 혜택·조건은 텔레그램·채널톡 상담으로 안내합니다\./);
  assert.doesNotMatch(visible, /통신혜택|통신 혜택|급전|폰깡|폰테크|\/topics\/|trust-bar|data-live/);
  assert.doesNotMatch(visible, /\{\{MAX_TOTAL\}\}/);
});

test("home page stays slim: one hero hook, no duplicate step sections", () => {
  const visible = home.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  assert.match(visible, /<h1[^>]*>몰랐던 유심 혜택<br>최대 66만원<\/h1>/);
  assert.match(visible, /id="heroTrust">서울평가정보㈜ 공식 안내<br>사업자등록번호 <span class="copy-nowrap">114-81-47958<\/span>/);
  assert.doesNotMatch(visible, /유심 혜택 확인 순서|문의부터 완료까지|class="steps-grid"|id="quickFlow"|class="empathy"|class="process"/);
  assert.doesNotMatch(visible, /class="guide-disclosure"|신청 방법|신청 순서/);
  assert.match(visible, /id="payoutNote"/);
  assert.match(visible, /class="hero-trust"/);
});

const RETENTION_MARKETING = /유심은 고객 보유|본인 명의로 계속|계속 보유·사용|유심을 수거|유심·단말은 고객 보유|고객이 계속 보유/;

test("public HTML avoids legacy USIM retention marketing hooks", () => {
  const pages = [
    ["home", home],
    ["guide", guide],
    ["structure", structure],
    ["about", about],
  ];
  for (const [name, html] of pages) {
    const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
    assert.doesNotMatch(visible, RETENTION_MARKETING, name);
  }
});

test("public Korean multiline copy and mobile readable text use native line wrapping", () => {
  assert.match(css, /white-space:\s*pre-line;\s*line-height:\s*1\.85/);
  assert.match(css, /\.hero-intro,\.consultation-intro,\.section-intro,\.step p,\.legacy-help,\.site-footer__terms\{/);
  assert.match(css, /word-break:keep-all/);
  assert.match(css, /overflow-wrap:break-word/);
  assert.match(guide, /\.lead,\.notice,\.section-head,\.micro,footer\{word-break:keep-all/);
  assert.match(guide, /@media\(max-width:420px\)\{\.row\{flex-wrap:wrap/);
  assert.match(links, /\.subtitle,\.disclosure,\.detail,small\{word-break:keep-all/);
});

test("structure page stays short: unified hook, payout rows, no legacy explainer blocks", () => {
  assert.match(structure, /몰랐던 유심 혜택으로 최대 66만원/);
  assert.match(structure, /3일 유지 확인[\s\S]*5만원 지급 대상/);
  assert.match(structure, /총 최대 66만원/);
  assert.match(structure, /id="operator-title"/);
  assert.match(structure, /김중근/);
  assert.doesNotMatch(structure, /개통 대상 회선|사업 구조 한눈에 보기|CLIME 이용 원칙|돈은 어디서 나오는가|혜택의 재원|유심의 귀속/);
});

test("guide page stays short: unified hero hook, milestone rows, no card explainer blocks", () => {
  assert.match(guide, /몰랐던 유심 혜택으로<br><strong>최대 66만원<\/strong>/);
  assert.match(guide, /data-milestones/);
  assert.match(guide, /data-total/);
  assert.match(guide, /footer-hook/);
  assert.match(guide, /href="\/disclosures\/">고지·안내/);
  assert.doesNotMatch(guide, /지급은 이렇게 결정됩니다|difference-title|<span class="card-number">01<\/span>/);
  assert.doesNotMatch(guide, /현재 지급 기준은 어떻게 확인하나요/);
});

test("about page stays short: unified hero hook, operator table, guide link, no card explainer blocks", () => {
  assert.match(about, /몰랐던 유심 혜택으로 최대 66만원/);
  assert.match(about, /id="operator-title"/);
  assert.match(about, /href="\/guide\/">혜택 조건/);
  assert.match(about, /114-81-47958/);
  assert.match(about, /footer-hook/);
  assert.match(about, /href="\/about\/">CLIME 소개<\/a>[\s\S]*href="\/disclosures\/">고지·안내/);
  assert.doesNotMatch(about, /지금 하는 일|card-number|참여는 세 단계|01<\/span>/);
  assert.doesNotMatch(about, /3일·15일·30일 유지 조건을 충족|비용은 회사 부담/);
});

test("visible FAQs are removed on main and guide, and not re-created by JavaScript or schema", () => {
  assert.doesNotMatch(home, /<section class="faq"|id="faq-title"|faqList|faqSchema|FAQPage/);
  assert.doesNotMatch(guide, /<section class="faq"|id="faq-title"|FAQPage/);
  assert.doesNotMatch(structure, /<section class="faq"|id="faq-title"|FAQPage|<details|<summary/);
  assert.doesNotMatch(contentService, /FAQPage/);
  assert.doesNotMatch(css, /\.faq(?:\s|\{|\-|\.)/);
  assert.doesNotMatch(topicsCss, /\.faq(?:\s|\{|\-|\.)/);
  assert.doesNotMatch(aiText, /홈페이지 접수 상태 조회 및 FAQ/);
});

test("SEO retains original service information without fabricated ratings or bot directives", () => {
  const json = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json);
  const graph=JSON.parse(json)["@graph"];
  assert.deepEqual(graph.map(x=>x["@type"]), ["Organization","WebSite","WebPage","Service"]);
  assert.match(graph.find(x=>x["@type"]==="WebPage").description, /몰랐던 유심 혜택으로 최대 66만원/);
  assert.doesNotMatch(graph.find(x=>x["@type"]==="WebPage").description, /3일|15일|30일/);
  assert.match(graph.find(x=>x["@type"]==="Service").description, /서울평가정보㈜가 운영합니다/);
  assert.doesNotMatch(graph.find(x=>x["@type"]==="Service").description, /통신혜택|급전|폰깡/);
  assert.doesNotMatch(json, /AggregateRating|"@type"\s*:\s*"Review"/);
  assert.match(guide, /rel="canonical" href="https:\/\/climekr\.com\/guide\/"/);
  assert.match(links, /name="robots" content="noindex,follow"/);
  assert.match(home, /rel="canonical" href="https:\/\/climekr\.com\/"/);
  assert.match(home, /id="payoutConditions"/);
  assert.match(home, /id="contact"/);
});

test("phrase breaks keep operator lines and milestone numbers intact", () => {
  const typography = read("../public/copy-typography.css");
  assert.match(typography, /@media \(min-width: 761px\) \{\s*br\.mo, \.only-mo \{ display: none; \}/);
  assert.match(typography, /@media \(max-width: 760px\) \{\s*br\.pc, \.only-pc \{ display: none; \}/);
  assert.match(typography, /word-break:\s*keep-all/);
  assert.doesNotMatch(typography, /word-break:\s*break-all/);
  for (const [name, html] of [["about", about], ["guide", guide], ["structure", structure], ["links", links], ["404", notFound]]) {
    assert.match(html, /class="copy-footer-lines"/, name);
    assert.match(html, /사업자등록번호 <span class="copy-nowrap">114-81-47958<\/span>/, name);
    assert.match(html, /<br class="mo">/, name);
  }
  assert.match(home, /id="eligibilityButton"[^>]*href="https:\/\/www\.credit\.or\.kr\/credit\/search"/);
  assert.match(home, /id="contactLookupLink"/);
  assert.match(structure, /3일 유지 확인[\s\S]*5만원/);
  assert.match(structure, /15일 유지 확인[\s\S]*7만원/);
  assert.match(structure, /30일 유지 확인[\s\S]*10만원/);
  assert.match(structure, /22만원 \/ 건/);
  assert.match(structure, /총 최대 66만원/);
  assert.match(guide, /3일 유지 확인[\s\S]*5만원 지급 대상/);
  assert.match(guide, /최대 66만원/);
});
