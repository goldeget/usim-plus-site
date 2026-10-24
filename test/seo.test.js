import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const llms = await readFile(new URL("../public/llms.txt", import.meta.url), "utf8");
const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const indexNowKey = "2cc7263262b5a365ad26c37e214acd2b";

test("publishes a canonical Korean title, description, and social preview metadata", () => {
  assert.match(page, /<title>클라임유심 \| 유심 개통 가능하면 최대 51만원<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/climekr\.com\/"\s*\/>/);
  assert.match(page, /name="description" content="[^\"]*클라임유심[^\"]*climekr 유심[^\"]*개통 가능 여부[^\"]*개통 후[^\"]*현황 사진[^\"]*최대 51만원[^\"]*"/);
  assert.doesNotMatch(page, /통신사|요금·약정|월 요금|해지 비용/);
  assert.match(page, /property="og:url" content="https:\/\/climekr\.com\/"/);
  assert.match(page, /name="robots" content="index,follow/);
});

test("includes accurate search structured data that matches visible FAQs", () => {
  const json = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json, "JSON-LD is present");
  const graph = JSON.parse(json)["@graph"];
  assert.ok(graph.some(item => item["@type"] === "Organization" && item.email === "help@climekr.com"));
  const faq = graph.find(item => item["@type"] === "FAQPage");
  assert.equal(faq.mainEntity.length, 7);
  for (const item of faq.mainEntity) {
    assert.ok(page.includes(`<summary>${item.name}</summary>`), `FAQ question is visible: ${item.name}`);
    assert.ok(page.includes(`<p>${item.acceptedAnswer.text}</p>`), `FAQ answer is visible: ${item.name}`);
  }
});

test("covers the requested climekr spellings and gives review searches useful, accurate guidance", () => {
  const json = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json, "JSON-LD is present");
  const graph = JSON.parse(json)["@graph"];
  const organization = graph.find(item => item["@type"] === "Organization");
  assert.ok(organization.alternateName.includes("climekr 유심"));
  assert.match(page, /<summary>클라임유심 후기나 climekr 유심 후기를 살펴볼 때 무엇을 확인해야 하나요\?<\/summary>/);
  assert.match(page, /후기를 볼 때 작성 시점과 실제 이용 경험인지 확인해 주세요/);
  assert.match(llms, /클라임유심 후기[\s\S]*climekr 유심 후기/);
  assert.match(llms, /클라임유심[\s\S]*climekr[\s\S]*참여 방법/);
  assert.match(llms, /본인 명의로 유심을 개통할 수 있는지 확인합니다[\s\S]*개통을 마친 뒤 현황 사진 한 장으로 신청합니다[\s\S]*유지 조건을 확인한 뒤 지급 대상이 결정됩니다/);
  assert.match(llms, /개통 후 사진 한 장으로 신청하는 방법과 유지 기간별 지급 금액/);
  assert.doesNotMatch(llms, /통신사|요금·약정|월 요금|해지 비용/);
  assert.doesNotMatch(llms, /사진 사전 검토|개통 현황 사진으로 사전 검토|유심 개통 사전 검토 안내/);
  assert.doesNotMatch(llms, /관련 검색어|이용 정보 검색어/);
  assert.doesNotMatch(page, /공개된 이용자 후기는 없습니다/);
  assert.doesNotMatch(llms, /공개된 이용자 후기는 없습니다/);
  assert.doesNotMatch(json, /AggregateRating|"@type"\s*:\s*"Review"/);
});

test("keeps private routes out of the public sitemap and gives AI readers accurate service context", () => {
  assert.match(sitemap, /<loc>https:\/\/climekr\.com\/<\/loc>/);
  assert.doesNotMatch(sitemap, /admin|api/);
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
