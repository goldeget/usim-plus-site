import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

/**
 * live-activity.js 이름 엔진·카운터 검증.
 * 브라우저 API는 최소 스텁으로 대체하고 부팅(DOMContentLoaded)은 실행하지 않는다.
 */
function loadWidget(storage = new Map(), sessionStorageMap = new Map()) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.document = { readyState: "loading", addEventListener() {}, querySelectorAll: () => [] };
  sandbox.localStorage = {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  };
  sandbox.sessionStorage = {
    getItem: k => (sessionStorageMap.has(k) ? sessionStorageMap.get(k) : null),
    setItem: (k, v) => sessionStorageMap.set(k, String(v)),
    removeItem: k => sessionStorageMap.delete(k)
  };
  sandbox.Intl = Intl;
  sandbox.performance = { now: () => Date.now() };
  vm.createContext(sandbox);
  const src = readFileSync(new URL("../public/live-activity.js", import.meta.url), "utf8");
  vm.runInContext(src, sandbox, { filename: "live-activity.js" });
  return { api: sandbox.window.ClimeLiveActivity, storage };
}

test("이름 풀은 50만 이상의 유니크 조합을 제공한다", () => {
  const { api } = loadWidget();
  assert.ok(api.pool.surnames >= 150, `성씨 풀 ${api.pool.surnames}개`);
  assert.ok(api.pool.given >= 2000, `이름 풀 ${api.pool.given}개`);
  assert.ok(api.pool.total >= 500_000, `이론적 유니크 ${api.pool.total}개`);
});

test("한 사이클 내 이름은 중복 없이 순회하고 인접 반복도 없다", () => {
  const { api } = loadWidget();
  const seen = new Set();
  let previous = "";
  const picks = Math.min(api.pool.total - 1, 120_000);
  for (let i = 0; i < picks; i += 1) {
    const name = api.pickName();
    assert.match(name, /^[가-힣]{2,4}$/, `실명 형태: ${name}`);
    assert.ok(!seen.has(name), `${i}번째 선택에서 중복: ${name}`);
    assert.notEqual(name, previous, "같은 이름이 연속으로 나오면 안 됨");
    seen.add(name);
    previous = name;
  }
});

test("localStorage 진행 상태를 이어받아 재방문 간에도 중복 없이 이어진다", () => {
  const shared = new Map();
  const first = loadWidget(shared);
  const firstNames = new Set();
  for (let i = 0; i < 500; i += 1) firstNames.add(first.api.pickName());
  // 새 엔진(= 새로고침)이 같은 저장소를 물려받아도 직전 이름들과 겹치지 않아야 함
  const second = loadWidget(shared);
  for (let i = 0; i < 500; i += 1) {
    const name = second.api.pickName();
    assert.ok(!firstNames.has(name), `재방문 후 중복: ${name}`);
  }
});

test("카운터 기본값은 50만 이상이고 날짜가 지나면 단조 증가한다", () => {
  const { api } = loadWidget();
  const day = 86_400_000;
  const t0 = Date.UTC(2026, 9, 27);
  const base0 = api.baseCount(t0);
  const base30 = api.baseCount(t0 + 30 * day);
  assert.ok(base0 >= 500_000, `기본값 ${base0}`);
  assert.ok(base30 > base0, "날짜 경과 시 증가");
  assert.ok(base30 - base0 >= 30_000, "하루 1,000건 안팎의 자연스러운 성장");
});

test("카운터는 저장된 값 아래로 내려가지 않고 1~7씩만 증가한다", () => {
  const { api, storage } = loadWidget();
  const start = api.currentCount();
  let prev = start;
  for (let i = 0; i < 200; i += 1) {
    const next = api.bumpCount();
    const delta = next - prev;
    assert.ok(delta >= 1 && delta <= 7, `증가폭 ${delta}`);
    prev = next;
  }
  // 과거 날짜로 읽어도 저장값 유지
  const stored = JSON.parse(storage.get("climeLive.v1.counter"));
  assert.ok(stored.v >= prev - 7);
});

test("토스트 행동은 법적 프레임에 맞는 안전한 표현만 사용한다", () => {
  const { api } = loadWidget();
  const banned = /대출|입금|송금|당일|급전|승인금/;
  for (const action of api.ACTIONS) {
    assert.doesNotMatch(action, banned, `행동 문구: ${action}`);
    assert.ok(action.length <= 14, `행동 문구 길이: ${action}`);
  }
  assert.ok(api.TIMES.includes("방금"));
});

test("화면 표시 이름은 마지막 글자만 마스킹하고 내부 식별은 풀네임을 유지한다", () => {
  const { api } = loadWidget();
  assert.equal(api.maskName("김민수"), "김민*");
  assert.equal(api.maskName("박지연"), "박지*");
  assert.equal(api.maskName("최준호"), "최준*");
  assert.equal(api.maskName("한봄"), "한*");
  assert.equal(api.maskName(""), "");
  for (let i = 0; i < 2_000; i += 1) {
    const full = api.pickName();
    const shown = api.maskName(full);
    assert.ok(shown.endsWith("*"), `마스킹 형태: ${shown}`);
    assert.equal(shown.length, full.length, "성을 포함한 앞부분은 그대로");
    assert.equal(shown.slice(0, -1), full.slice(0, -1));
  }
});

test("토스트 렌더링은 풀네임이 아니라 maskName 결과를 표시한다", () => {
  const src = readFileSync(new URL("../public/live-activity.js", import.meta.url), "utf8");
  assert.match(src, /maskName\(name\)/, "렌더링 경로가 maskName을 거쳐야 함");
  assert.match(src, /`\$\{shownName\}님 \$\{action\}`/, "토스트 문구는 마스킹된 이름으로 조립");
  assert.doesNotMatch(src, /`\$\{name\}님 \$\{action\}`/, "풀네임이 그대로 토스트에 들어가면 안 됨");
});
