import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const llms = await readFile(new URL("../public/llms.txt", import.meta.url), "utf8");
const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const indexNowKey = "2cc7263262b5a365ad26c37e214acd2b";

test("publishes a canonical Korean title, description, and social preview metadata", () => {
  assert.match(page, /<title>클라임유심 \| 유심 혜택 · 유심 혜택 확인 · 최대 66만원 \| 서울평가정보\(주\)<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/climekr\.com\/"\s*\/>/);
  assert.match(page, /name="description" content="[^\"]*서울평가정보\(주\)[^\"]*유심 혜택 확인[^\"]*최대 66만원[^\"]*"/);
  assert.doesNotMatch(page, /통신사|요금·약정|월 요금|해지 비용/);
  assert.doesNotMatch(page, /통신혜택|통신 혜택|급전|폰깡|폰테크|<script src="\/live-activity/);
  assert.doesNotMatch(page, /href="\/topics\//);
  assert.match(page, /property="og:url" content="https:\/\/climekr\.com\/"/);
  assert.match(page, /name="robots" content="index,follow/);
});

test("describes the real public service without inventing hidden FAQ or review schema", () => {
  const json = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json, "JSON-LD is present");
  const graph = JSON.parse(json)["@graph"];
  const types = graph.map(item => item["@type"]);
  for (const type of ["Organization", "WebSite", "WebPage", "Service"]) {
    assert.ok(types.includes(type), type);
  }
  assert.ok(graph.some(item => item["@type"] === "Organization" && item.email === "help@climekr.com"));
  assert.match(graph.find(item => item["@type"] === "WebPage").description, /서울평가정보\(주\)가 운영하는 유심 혜택 안내/);
  assert.match(graph.find(item => item["@type"] === "WebPage").description, /유심 혜택 확인/);
  const org = graph.find(item => item["@type"] === "Organization");
  assert.equal(org["@id"], "https://climekr.com/#organization");
  assert.equal(org.taxID, "114-81-47958");
  assert.equal(org.address.streetAddress, "토정로 144 (상수동, 건양사빌딩)");
  assert.deepEqual(org.sameAs, ["https://blog.naver.com/climeusimguide"]);
  assert.equal(graph.find(item => item["@type"] === "Service").serviceType, "본인 명의 회선(알뜰·선불) 조건부 혜택 안내");
  assert.match(graph.find(item => item["@type"] === "Service").description, /3일·15일·30일/);
  assert.ok(!types.includes("FAQPage"), "Do not describe removed FAQ as visible");
  assert.doesNotMatch(page, /<section class="faq"|id="faq-title"|class="faq-list"/);
  assert.doesNotMatch(json, /AggregateRating|"@type"\s*:\s*"Review"/);
});

test("covers the requested climekr spellings and gives review searches useful, accurate guidance", () => {
  const json = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json, "JSON-LD is present");
  const graph = JSON.parse(json)["@graph"];
  const organization = graph.find(item => item["@type"] === "Organization");
  assert.ok(organization.alternateName.includes("climekr 유심"));
  assert.match(llms, /클라임유심 후기[\s\S]*climekr 유심 후기/);
  assert.match(llms, /클라임유심[\s\S]*climekr[\s\S]*참여 방법/);
  assert.match(llms, /개통 가능 여부 확인 버튼[\s\S]*상담창으로 사진을 보냅니다[\s\S]*유지 조건을 확인한 뒤 지급 대상이 결정됩니다/);
  assert.match(llms, /서울평가정보\(주\)가 운영합니다/);
  assert.match(llms, /사업자등록번호: 114-81-47958/);
  assert.match(llms, /몰랐던 유심 혜택을 서울평가정보\(주\) 공식 안내로 유심 혜택 확인 후/);
  assert.match(llms, /3일·15일·30일 유지 확인 후 단계 지급 대상이 정해지며, 최대 66만원/);
  assert.doesNotMatch(llms.slice(0, 500), /통신혜택|통신 혜택|급전|폰깡|폰테크/);
  assert.doesNotMatch(llms, /\/topics\/|주제별 정보 안내/);
  assert.doesNotMatch(llms, /명의도용|소액결제|불법 개통|위험 없음|100% 안전/);
  assert.match(llms, /회사는 수거하지 않습니다/);
  assert.doesNotMatch(llms, /사진 사전 검토|개통 현황 사진으로 사전 검토|유심 개통 사전 검토 안내/);
  assert.doesNotMatch(llms, /관련 검색어|이용 정보 검색어/);
  assert.doesNotMatch(page, /공개된 이용자 후기는 없습니다/);
  assert.doesNotMatch(llms, /공개된 이용자 후기는 없습니다/);
  assert.doesNotMatch(json, /AggregateRating|"@type"\s*:\s*"Review"/);
});

test("keeps private routes out of the public sitemap and gives AI readers accurate service context", () => {
  assert.match(sitemap, /<loc>https:\/\/climekr\.com\/<\/loc>/);
  assert.doesNotMatch(sitemap, /admin|api/);
  assert.doesNotMatch(sitemap, /topics/);
  assert.match(sitemap, /<loc>https:\/\/climekr\.com\/disclosures\/<\/loc>/);
  assert.match(llms, /실제 지급 대상은 신청 내용과 유지 조건 확인 후 결정됩니다/);
  assert.match(llms, /접수 후 30일/);
  assert.match(llms, /help@climekr\.com/);
});

test("blocks crawling on the admin hostname and private public-host routes", async () => {
  const { onRequest } = await import("../functions/robots.txt.js");
  const publicResponse = await onRequest({ request: new Request("https://climekr.com/robots.txt") });
  const publicRules = await publicResponse.text();
  assert.match(publicRules, /Sitemap: https:\/\/climekr\.com\/sitemap\.xml/);
  assert.match(publicRules, /Disallow: \/admin\//);
  assert.match(publicRules, /Disallow: \/api\//);
  assert.doesNotMatch(publicRules, /topics/);

  const adminResponse = await onRequest({ request: new Request("https://admin.climekr.com/robots.txt") });
  assert.match(await adminResponse.text(), /Disallow: \/\s*$/);

  const previewResponse = await onRequest({ request: new Request("https://usim-plus-site.pages.dev/robots.txt") });
  const previewRules = await previewResponse.text();
  assert.match(previewRules, /Allow: \/\s*$/);
  assert.doesNotMatch(previewRules, /Sitemap:/);
});

test("hosts the IndexNow verification key at the declared public URL", async () => {
  const keyFile = await readFile(new URL(`../public/${indexNowKey}.txt`, import.meta.url), "utf8");
  assert.equal(keyFile.trim(), indexNowKey);
});

const naverToken = "navercb78a18ae519c02b17c8618a7b72822c";
const naverMeta = "4787a0e0a2225a79b88b77825a36d5cf27429080";

test("publishes the Naver site verification meta tag on the homepage", () => {
  assert.match(page, new RegExp(`<meta name="naver-site-verification" content="${naverMeta}" />`));
});

test("returns the Naver HTML verification token with status 200", async () => {
  const file = await readFile(new URL(`../public/${naverToken}.html`, import.meta.url), "utf8");
  assert.equal(file.trim(), naverToken);
  const { onRequest } = await import(`../functions/${naverToken}.html.js`);
  const response = await onRequest();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), naverToken);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
