import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("preserves the supplied Korean responsive page and its main visual sections", () => {
  for (const content of ["<html lang=\"ko\">", "class=\"application-reward\"", "id=\"precheckForm\"", "id=\"faq\"", "id=\"contact\"", "class=\"sim-image\""]) {
    assert.ok(html.includes(content), `missing existing page element: ${content}`);
  }
});

test("submits a photo to the real endpoint and keeps a one-time receipt and status lookup", () => {
  assert.match(html, /\/api\/applications(?:["'`])/);
  assert.match(html, /\/api\/applications\/status/);
  assert.match(html, /\/api\/applications\/config/);
  assert.match(html, /FormData/);
  assert.match(html, /cf-turnstile-response/);
  assert.match(html, /조회 토큰|접수 토큰/);
  assert.match(html, /복사/);
});

test("requires consent and a Turnstile challenge before upload", () => {
  assert.match(html, /id="privacyConsent"[^>]*name="privacyConsent"[^>]*required/);
  assert.match(html, /id="turnstileWidget"/);
  assert.match(html, /turnstile\.render/);
  assert.match(html, /10MB|10MB/);
});

test("defers the Turnstile script until the application section is near the viewport", () => {
  assert.match(html, /new IntersectionObserver/);
  assert.match(html, /rootMargin:\s*['"]240px 0px['"]/);
  assert.match(html, /observe\(document\.getElementById\(['"]apply['"]\)\)/);
  assert.match(html, /접수 영역에 가까워지면 자동 확인을 불러옵니다/);
  assert.doesNotMatch(html, /^\s*setupTurnstile\(\);\s*$/m);
});

test("discloses the photo purpose, selected retention, controller, contact, and refusal right", () => {
  for (const content of ["개통 현황 사진", "30일", "에스씨아이평가정보(주)", "임동훈", "help@climekr.com", "동의하지 않으면", "Cloudflare"]) {
    assert.ok(html.includes(content), `missing privacy disclosure: ${content}`);
  }
});

test("discloses receipt status metadata cleanup timing", () => {
  assert.match(html, /접수.*상태.*60일|60일.*접수.*상태/);
  assert.match(html, /사진의 30일 기본 보관 기간이 끝난 뒤.*60일 경과 시점까지/);
  assert.match(html, /60일이 경과하면 매일 자동 삭제/);
  assert.match(html, /실제 삭제 시점은 예약 작업 일정/);
  assert.doesNotMatch(html, /최대 30일 더 보관|접수 또는 검토 결정 후 최대 60일/);
  assert.ok(html.includes("삭제 후에는 접수 상태를 조회할 수 없습니다."));
});

test("removes mockup-only claims and keeps all support channels inactive", () => {
  for (const content of ["현재는 화면 목업입니다", "이 목업에서는", "정식 접수·파일 전송은 연결되지 않은 목업입니다", "목업 시연입니다"]) {
    assert.equal(html.includes(content), false, `stale mockup copy remains: ${content}`);
  }
  for (const key of ["telegram", "line", "kakao", "channeltalk"]) {
    assert.match(html, new RegExp(`data-contact="${key}"[^>]*aria-disabled="true"`));
  }
});
