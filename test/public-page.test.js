import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const adminContent = await readFile(new URL("../public/admin/content.html", import.meta.url), "utf8");
const contentApi = await readFile(new URL("../functions/api/content.js", import.meta.url), "utf8");
const userFlowCss = await readFile(new URL("../public/user-flow.css", import.meta.url), "utf8");

test("preserves the dark visual identity and exposes direct consultation without a file form", () => {
  for (const element of ['<html lang="ko">','class="hero-payouts"','class="sim-image"','id="contact"','id="heroApplyButton" href="#contact"']) assert.ok(html.includes(element), element);
  assert.doesNotMatch(html, /type="file"|id="precheckForm"|FormData|challenges\.cloudflare\.com|turnstile\.render/);
  assert.match(html, /조회 사진은 상담창으로 보내 주세요/);
  assert.match(html, /name="color-scheme" content="dark"/);
});

test("keeps existing receipt status lookup and privacy information after new submissions end", () => {
  assert.match(html,/\/api\/applications\/status/);
  assert.match(html,/기존 접수 조회/);
  assert.match(html,/기존 홈페이지 접수의 개인정보 보관 안내/);
  assert.match(html,/접수 또는 검토 결정 후 60일/);
  assert.match(html,/검토 결정 후 30일/);
  assert.match(html,/같은 인터넷 접속.*같은 사람이라고 단정/);
  assert.match(html,/상담창으로 보낸 사진과 진행 상황은 같은 상담창에서/);
});

test("consultation addresses remain managed by the authenticated editor", () => {
  for(const key of ['line','telegram','channeltalk']) {
    assert.match(html,new RegExp(`data-contact="${key}"`));
    assert.match(adminContent,new RegExp(`id="${key}Link"`));
  }
  assert.match(html,/updateContactLinks\(content\.supportLinks\)/);
  assert.match(html,/content\.schemaVersion===3/);
  assert.match(html,/candidate\.protocol==='https:'/);
  assert.match(html,/if\(anchor\.getAttribute\('aria-disabled'\)!=='true'\)return/);
  assert.match(adminContent,/사진을 받고 답장할 수 있는 1:1 대화 주소/);
  assert.match(html,/현재 연결된 상담 채널이 없습니다/);
  assert.match(html,/mailto:help@climekr\.com/);
});

test("keeps visible centered feedback for lookup and unavailable channels", () => {
  assert.match(html,/id="toastTitle"/);
  assert.match(html,/id="toastMessage"/);
  assert.match(html,/showToast\('상태를 확인하지 못했습니다'/);
  assert.match(html,/showToast\('상담 채널 준비 중'/);
  assert.match(userFlowCss,/#toast\.toast\s*\{[^}]*left:\s*50%[^}]*top:\s*50%/);
});

test("protects the supplied business certificate while showing minimal operator identity", () => {
  assert.match(html,/에스씨아이평가정보\(주\)/);
  assert.match(html,/대표자.*임동훈/);
  for(const value of ['114-81-47958','110111-0853419','sci0001@hometax.go.kr']) assert.equal(html.includes(value),false);
});


test("preserves the original query destination separately from photo conversations", () => {
  const links=[...html.matchAll(/<a\b[^>]*href="https:\/\/www\.credit\.or\.kr\/credit\/search"[^>]*>/g)];
  assert.equal(links.length,3,"query links remain in hero, contact section and instructions");
  for(const link of links){assert.match(link[0],/target="_blank"/);assert.match(link[0],/rel="noopener noreferrer"/);}
  assert.match(html, /id="eligibilityButton"/);
  assert.match(html, /id="heroApplyButton" href="#contact">조회 사진 보내고 상담하기/);
  assert.doesNotMatch(html,/type="file"/);
});
