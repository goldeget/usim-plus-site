import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");

test("static Pages project explicitly defines 404 to suppress SPA fallback for deleted URLs", () => {
  const html = read("../public/404.html");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /페이지를 찾을 수 없습니다/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/guide\/"/);
  assert.doesNotMatch(html, /투자 수익|채굴 투자|일일 수익률/);
});

test("the existing official route files remain accessible", () => {
  const home = read("../public/index.html");
  const guide = read("../public/guide/index.html");
  const social = read("../public/links/index.html");
  const admin = read("../public/admin/login.html");
  assert.match(home, /<title>클라임유심/);
  assert.match(guide, /<title>혜택 조건 \| 텔레그램·채널톡 상담/);
  assert.match(social, /<title>CLIME 공식 상담 링크/);
  assert.match(admin, /<!doctype html>/i);
});
