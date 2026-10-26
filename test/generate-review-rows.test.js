import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageBucketForIndex,
  generateReviewRows,
  isFormalAgeBucket,
  personaForIndex,
  ratingDistributionForCorpus
} from "../scripts/generate-review-rows.mjs";
import {
  makeSnippet,
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_INTERNAL_ID_PATTERN,
  reviewHashes
} from "../functions/_lib/reviews.js";
import {
  presentReview,
  reviewDateMismatch,
  reviewIdForSlot
} from "../functions/_lib/review-dates.js";

test("generated review corpus has unique dedup hashes and realistic bounds", async () => {
  const rows = generateReviewRows(10_000);
  assert.equal(rows.length, 10_000);
  const bodySha = new Set();
  const normSha = new Set();
  const snippetSha = new Set();
  for (const row of rows) {
    assert.ok(row.body.length >= REVIEW_BODY_MIN, `row ${row.rowId} too short`);
    assert.ok(row.body.length <= REVIEW_BODY_MAX, `row ${row.rowId} too long`);
    assert.doesNotMatch(row.body, /\(후기-\d+\)/);
    assert.doesNotMatch(row.body, REVIEW_INTERNAL_ID_PATTERN);
    assert.doesNotMatch(row.displayName, REVIEW_INTERNAL_ID_PATTERN);
    assert.doesNotMatch(row.rowId, /corpus-/i);
    assert.doesNotMatch(row.body, /corpus-\d{5}/i);
    assert.doesNotMatch(row.displayName, /corpus-\d{5}/i);
    assert.match(row.displayName, /^[가-힣]/);
    const hashes = await reviewHashes(row.body);
    assert.ok(!bodySha.has(hashes.body_sha256), `duplicate body ${row.rowId}`);
    assert.ok(!normSha.has(hashes.body_norm_sha256), `duplicate norm ${row.rowId}`);
    assert.ok(!snippetSha.has(hashes.snippet_sha256), `duplicate snippet ${row.rowId}`);
    bodySha.add(hashes.body_sha256);
    normSha.add(hashes.body_norm_sha256);
    snippetSha.add(hashes.snippet_sha256);
  }
  const hist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) hist[row.rating] += 1;
  const expected = ratingDistributionForCorpus(10_000);
  assert.deepEqual(hist, { 1: 0, 2: 0, 3: expected[3], 4: expected[4], 5: expected[5] });
  const mean = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  assert.ok(Math.abs(mean - 4.8) < 1e-9, `mean rating ${mean} should be 4.8`);
  assert.ok(
    rows.every(r => r.tags && !Object.hasOwn(r.tags, "region")),
    "tags must not include region"
  );
  const placeLike = /(?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|제주)\s*(?:에서|기준)/;
  assert.ok(
    rows.every(r => !placeLike.test(r.body)),
    "body text must not mention region/place phrasing"
  );
  const publishedMs = rows.map(r => new Date(r.publishedAt).getTime());
  assert.ok(publishedMs.every((t, i) => i === 0 || t >= publishedMs[i - 1]), "publishedAt increases monotonically");
  const spanMs = publishedMs[publishedMs.length - 1] - publishedMs[0];
  const threeYearsMs = 3 * 365.25 * 24 * 60 * 60 * 1000;
  assert.ok(spanMs >= threeYearsMs * 0.98 && spanMs <= threeYearsMs * 1.02, "publishedAt span is ~3 years");
  const stepMs = spanMs / (rows.length - 1);
  for (let i = 1; i < rows.length; i += 1) {
    const delta = publishedMs[i] - publishedMs[i - 1];
    assert.ok(Math.abs(delta - stepMs) / stepMs < 0.02, `even spacing at index ${i}`);
  }
  const featured = rows.filter(r => r.featured);
  assert.equal(featured.length, 24);
  assert.ok(featured.every(r => r.sortBoost > 0));
  const newest = rows.at(-1);
  const oldest = rows[0];
  assert.equal(newest.rowId, "10000", "last generated row is corpus row 10000");
  assert.equal(oldest.rowId, "00001", "first generated row is corpus row 1");
  assert.equal(
    new Date(newest.publishedAt).getTime(),
    Math.max(...publishedMs),
    "row 10000 has maximum publishedAt (newest = highest index)"
  );
  assert.equal(
    new Date(oldest.publishedAt).getTime(),
    Math.min(...publishedMs),
    "row 1 has minimum publishedAt (~3 years before row 10000)"
  );
  assert.ok(Math.abs(Date.now() - new Date(newest.publishedAt).getTime()) < 60_000, "newest row publishedAt is today");
  assert.ok(new Date(newest.publishedAt) > new Date(oldest.publishedAt), "row 10000 is newer than row 1");
});

test("generated corpus voice: USIM PLUS 급전 platform theme and age buckets", () => {
  const rows = generateReviewRows(10_000);
  const themeRe =
    /급전|융통|유심\s*플랫폼|USIM|0원|담당자|지급|사진\s*캡처|회사|자금|대출|생활비|막힌|부담|통신사\s*실적|불법\s*대출|자격/;
  const platformRe = /유심\s*플랫폼|USIM\s*PLUS|0원|담당자|사진\s*캡처/;
  const telecomOnlyLead = /^[^.]{0,80}(번호\s*이동|신규\s*개통)\s*관련으로만/;
  let themed = 0;
  let platformThemed = 0;
  let formalRows = 0;
  let casualWithEmoticon = 0;
  let formalWithEmoticon = 0;
  const bucketCounts = { "20s": 0, "30s": 0, "40s": 0, "50s": 0, "60s": 0, "70s": 0 };
  const personaLabels = ["경단녀", "육아맘", "대학생", "직장인", "사업자", "주부"];
  const personaCounts = Object.fromEntries(personaLabels.map(label => [label, 0]));
  const personaVoice = Object.fromEntries(personaLabels.map(label => [label, { casual: 0, formal: 0 }]));
  for (let i = 1; i <= 10_000; i += 1) {
    const bucket = ageBucketForIndex(i);
    bucketCounts[bucket] += 1;
  }
  for (const row of rows) {
    const idx = Number(row.rowId);
    const bucket = ageBucketForIndex(idx);
    assert.equal(bucketCounts[bucket] > 0, true);
    if (themeRe.test(row.body)) themed += 1;
    if (platformRe.test(row.body)) platformThemed += 1;
    assert.ok(!telecomOnlyLead.test(row.body), `row ${row.rowId} reads as telecom-only lead`);
    const formal = isFormalAgeBucket(bucket);
    if (formal) {
      formalRows += 1;
      assert.match(
        row.body,
        /(습니다|였습니다|하였습니다|입니다|였어요)[.!?]?(?:\s[🙂😅👍])?$/u,
        `formal bucket row ${row.rowId}`
      );
      if (/[🙂😅👍]|ㅠㅠ/.test(row.body)) formalWithEmoticon += 1;
    } else {
      assert.match(
        row.body,
        /(어요|았어요|했어요|였어요|ㅠㅠ|🙂|😅)[.!?]?(?:\s[🙂😅👍])?$/u,
        `casual bucket row ${row.rowId}`
      );
      if (/[🙂😅👍]|ㅠㅠ/.test(row.body)) casualWithEmoticon += 1;
    }
    const persona = personaForIndex(idx);
    const found = personaLabels.filter(label => (
      label === "사업자" ? /사업자(?!금)/.test(row.body) : row.body.includes(label)
    ));
    assert.deepEqual(found, [persona], `row ${row.rowId} persona`);
    personaCounts[persona] += 1;
    personaVoice[persona][formal ? "formal" : "casual"] += 1;
    assert.match(row.body, /대출/, `row ${row.rowId} loan rejection`);
    assert.match(row.body, /해결|풀렸|마련/, `row ${row.rowId} funds arranged`);
    assert.match(row.body, /통신사\s*실적/, `row ${row.rowId} carrier performance`);
    assert.doesNotMatch(row.body, /가족에게/);
    assert.doesNotMatch(row.body, /안내 문구를 그대로 전달/);
    assert.doesNotMatch(row.body, /그대로 전달/);
    if (persona === "대학생") {
      assert.ok(bucket === "20s" || bucket === "30s", `row ${row.rowId} 대학생 age`);
      assert.equal(formal, false, `row ${row.rowId} 대학생 voice`);
      assert.match(row.body, /용돈/);
    }
    if (persona === "사업자") assert.match(row.body, /사업자금/);
  }
  assert.ok(themed >= 9_500, `expected most rows to mention 급전/platform theme, got ${themed}`);
  assert.ok(
    platformThemed >= 9_000,
    `expected most rows to mention USIM PLUS platform pillars, got ${platformThemed}`
  );
  assert.ok(
    Math.abs(formalRows - 10_000 / 2) <= 1,
    `~half of rows use 50s–70s formal voice (got ${formalRows})`
  );
  assert.equal(formalWithEmoticon, 0, "formal age buckets should not use emoticons");
  assert.ok(casualWithEmoticon > 100 && casualWithEmoticon < 5_000, "some casual rows include emoticons");
  for (const n of Object.values(bucketCounts)) {
    assert.ok(Math.abs(n - 10_000 / 6) <= 2, "age buckets evenly split");
  }
  for (const label of personaLabels) {
    assert.ok(personaCounts[label] >= 700, `${label} count ${personaCounts[label]}`);
  }
  assert.ok(personaCounts["대학생"] < 2500, "대학생 stays a younger slice, not the whole corpus");
  assert.equal(personaVoice["대학생"].formal, 0);
  assert.ok(personaVoice["대학생"].casual >= 700);
  for (const label of ["주부", "직장인", "사업자", "육아맘", "경단녀"]) {
    assert.ok(personaVoice[label].casual > 0 && personaVoice[label].formal > 0, `${label} spans ages`);
  }
});

function kstCalendar(iso) {
  const bag = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hourCycle: "h23"
  }).formatToParts(new Date(iso))) {
    if (part.type !== "literal") bag[part.type] = Number(String(part.value).replace(/[^\d]/g, ""));
  }
  return bag;
}

test("review body calendar dates match publishedAt in Asia/Seoul", () => {
  const rows = generateReviewRows(10_000);
  const sampleIds = new Set(["00001", "00017", "00500", "02500", "05000", "07500", "09999", "10000"]);
  const monthDayRe = /(\d{1,2})월\s*(\d{1,2})일/g;
  const monthRe = /(\d{1,2})월/g;
  const yearRe = /(\d{4})년/g;
  const durationRe = /(?:3|15|30)일\s*유지/g;
  for (const row of rows) {
    assert.doesNotMatch(row.body, /\d+\s*분경/, `${row.rowId} has a minute stamp`);
    assert.doesNotMatch(row.body, /\d+\s*분/, `${row.rowId} has a clock minute`);
    assert.doesNotMatch(row.body, /corpus-/i, `${row.rowId} leaks corpus id`);
    const cal = kstCalendar(row.publishedAt);
    yearRe.lastIndex = 0;
    monthRe.lastIndex = 0;
    monthDayRe.lastIndex = 0;
    durationRe.lastIndex = 0;
    for (const match of row.body.matchAll(yearRe)) {
      assert.equal(Number(match[1]), cal.year, `${row.rowId} year`);
    }
    yearRe.lastIndex = 0;
    for (const match of row.body.matchAll(monthRe)) {
      assert.equal(Number(match[1]), cal.month, `${row.rowId} month`);
    }
    monthRe.lastIndex = 0;
    monthDayRe.lastIndex = 0;
    for (const match of row.body.matchAll(monthDayRe)) {
      assert.equal(Number(match[1]), cal.month, `${row.rowId} month-day month`);
      assert.equal(Number(match[2]), cal.day, `${row.rowId} month-day day`);
    }
    monthDayRe.lastIndex = 0;
    durationRe.lastIndex = 0;
    const stray = row.body.replace(durationRe, "").replace(monthDayRe, "").match(/(\d{1,2})일/);
    assert.equal(stray, null, `${row.rowId} mentions a different day ${stray && stray[0]}`);
    if (sampleIds.has(row.rowId)) {
      assert.match(row.body, new RegExp(`${cal.month}월\\s*${cal.day}일`), `${row.rowId} should mention its Seoul date`);
    }
  }
  const lengths = rows.map(row => row.body.length);
  assert.ok(Math.min(...lengths) < 220, "some reviews stay short");
  assert.ok(Math.max(...lengths) > 420, "some reviews run long");
});

function displayedSkeleton(text, displayName) {
  let value = String(text ?? "").normalize("NFC");
  const name = String(displayName ?? "");
  if (name) value = value.split(name).join(" ");
  const bare = name.replace(/\*/g, "");
  if (bare.length >= 2) value = value.split(bare).join(" ");
  value = value
    .replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ")
    .replace(/(?:일|월|화|수|목|금|토)요일/g, " ")
    .replace(/늦은 밤에|저녁 무렵에|아침 일찍|출근 전에|오전 중에|오후 중에|점심시간에|밤중에|새벽에|오전에|점심에|오후에|퇴근하고|저녁에|밤에/g, " ");
  return value.replace(/\s+/g, " ").trim();
}

test("displayed review skeletons are unique after dates, weekdays, times, and names", () => {
  const today = new Date("2026-10-27T03:00:00.000Z");
  const rows = generateReviewRows(10_000);
  const skeletons = new Map();
  for (let slot = 0; slot < rows.length; slot += 1) {
    const row = rows[slot];
    const shown = presentReview({
      id: reviewIdForSlot(slot),
      slot,
      rating: row.rating,
      displayName: row.displayName,
      basePublishedAt: row.publishedAt,
      snippet: makeSnippet(row.body),
      tags: row.tags,
      featured: row.featured,
      body: row.body
    }, today, { includeBody: true });
    assert.equal(reviewDateMismatch(shown.body, shown.publishedAt), null, `${row.rowId} display date`);
    assert.doesNotMatch(shown.body, /가족에게\s*전달/);
    assert.doesNotMatch(shown.body, /가족에게\s*설명/);
    assert.doesNotMatch(shown.body, /안내 문구를 그대로 전달/);
    assert.doesNotMatch(shown.body, /가족에게/);
    const skeleton = displayedSkeleton(shown.body, shown.displayName);
    const prior = skeletons.get(skeleton);
    assert.equal(prior, undefined, `skeleton collision ${prior} and ${row.rowId}`);
    skeletons.set(skeleton, row.rowId);
  }
  assert.equal(skeletons.size, 10_000);
});

test("generated corpus snippet prefixes are diverse", async () => {
  const rows = generateReviewRows(10_000);
  const prefix60 = new Set();
  for (const row of rows) {
    const { snippet } = await reviewHashes(row.body);
    prefix60.add(snippet.slice(0, 60));
  }
  assert.ok(prefix60.size >= 9800, `expected diverse snippet prefixes, got ${prefix60.size}`);
});
