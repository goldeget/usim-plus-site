import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { onRequest } from "../functions/_middleware.js";
import { isRetiredInvestmentPath } from "../functions/_lib/retired-investment.js";

const about = readFileSync(new URL("../public/about/index.html", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");

function context(url) {
  let nextCalls = 0;
  return {
    value: {
      request: new Request(url),
      env: {},
      next: async () => {
        nextCalls += 1;
        return new Response("asset", { status: 200 });
      }
    },
    get nextCalls() { return nextCalls; }
  };
}

test("the CLIME introduction replaces the retired investment about page with the current USIM service", () => {
  assert.match(about, /<title>CLIME 소개 \| 클라임유심 · 유심 개통 혜택<\/title>/);
  assert.match(about, /rel="canonical" href="https:\/\/climekr\.com\/about\/"/);
  assert.match(about, /서울평가정보㈜가 운영하는 유심 개통 혜택 안내입니다/);
  assert.match(about, /대출 상품이 아니며/);
  assert.match(about, /114-81-47958/);
  assert.doesNotMatch(about, /미래 자산|주간 수익|원금 전액|만기까지|USDT|싱가포르/);
  assert.match(sitemap, /<loc>https:\/\/climekr\.com\/about\/<\/loc>/);
});

test("retired investment URLs are gone and current USIM URLs stay available", async () => {
  for (const path of ["/invest", "/invest/green-energy", "/en/help/how-usdt", "/partners", "/ops", "/support", "/legal/privacy", "/trust/verify", "/events", "/community"]) {
    assert.equal(isRetiredInvestmentPath(path), true, path);
    const retired = context(`https://climekr.com${path}`);
    const response = await onRequest(retired.value);
    assert.equal(response.status, 410, path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex");
    assert.match(await response.text(), /유심 개통 혜택/);
    assert.equal(retired.nextCalls, 0);
  }

  for (const path of ["/", "/about/", "/guide/", "/reviews/", "/structure/", "/disclosures/", "/apple-touch-icon.png"]) {
    assert.equal(isRetiredInvestmentPath(path), false, path);
    const current = context(`https://climekr.com${path}`);
    const response = await onRequest(current.value);
    assert.equal(response.status, 200, path);
    assert.equal(current.nextCalls, 1);
  }
});

test("retired /topics pages redirect with 301 to the product pages", async () => {
  const cases = {
    "/topics": "/guide/",
    "/topics/": "/guide/",
    "/topics/urgent-money/": "/guide/",
    "/topics/loan-rejected/": "/guide/",
    "/topics/business/": "/guide/",
    "/topics/usim-benefit/": "/structure/"
  };
  for (const [path, location] of Object.entries(cases)) {
    const current = context(`https://climekr.com${path}`);
    const response = await onRequest(current.value);
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get("location"), `https://climekr.com${location}`, path);
    assert.equal(current.nextCalls, 0);
  }
});

test("www and bare about URLs resolve to the canonical USIM introduction", async () => {
  const www = context("https://www.climekr.com/about");
  const wwwResponse = await onRequest(www.value);
  assert.equal(wwwResponse.status, 308);
  assert.equal(wwwResponse.headers.get("location"), "https://climekr.com/about/");

  const bare = context("https://climekr.com/about?from=search");
  const bareResponse = await onRequest(bare.value);
  assert.equal(bareResponse.status, 308);
  assert.equal(bareResponse.headers.get("location"), "https://climekr.com/about/?from=search");
  assert.equal(bare.nextCalls, 0);
});
