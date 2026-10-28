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
import { reviewTemplateCount } from "../scripts/review-human-bodies.mjs";

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

test("generated corpus voice: 유심 혜택 consult notes and age buckets", () => {
  const rows = generateReviewRows(10_000);
  const themeRe =
    /유심\s*혜택|0원|담당자|사진|캡처|회사|부담|무료|수수료|안내|조건/;
  const platformRe = /유심\s*혜택|사진|캡처/;
  const riskRe = /대출|급전|보이스피싱|스미싱|내구제|대포폰|폰깡|선불폰|유심\s*개통|신용대출|당일\s*지급|카드론|기대출|사기/;
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
  const forbidden = [
    ["읽다", /읽다/],
    ["열다", /열다/],
    ["찾다", /찾다/],
    ["묻다", /묻다/],
    ["조건이 짧", /조건이 짧/],
    ["확인후", /확인후/],
    ["사업자금", /사업자금/],
    ["맛집", /맛집/],
    ["음식점", /음식점/],
    ["외식", /외식/],
    ["대출", /대출/],
    ["급전", /급전/],
    ["식당", /식당/],
    ["배달", /배달/],
    ["배민", /배민/],
    ["메뉴", /메뉴/],
    ["맛있", /맛있/],
    ["포장", /포장/],
    ["웨이팅", /웨이팅/]
  ];
  const forbiddenHits = Object.fromEntries(forbidden.map(([name]) => [name, 0]));
  let sleeping = 0;
  let noAmount = 0;
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
        /(습니다|였습니다|하였습니다|입니다|였어요)[.!?]?(?:\s🙂)?$/u,
        `formal bucket row ${row.rowId}`
      );
      if (/[🙂👍]|ㅠㅠ/.test(row.body)) formalWithEmoticon += 1;
    } else {
      assert.match(
        row.body,
        /(어요|어용|아요|해요|했어요|했어용|였어요|네요|함|음|ㅋㅋ|ㅎㅎ|ㅠㅠ|🙂)[.!?]?(?:\s🙂)?$/u,
        `casual bucket row ${row.rowId}`
      );
      if (/[🙂👍]|ㅠㅠ/.test(row.body)) casualWithEmoticon += 1;
    }
    const persona = personaForIndex(idx);
    assert.equal(row.tags.persona, persona, `row ${row.rowId} persona tag`);
    personaCounts[persona] += 1;
    personaVoice[persona][formal ? "formal" : "casual"] += 1;
    assert.doesNotMatch(row.body, riskRe, `row ${row.rowId} risk phrase`);
    assert.doesNotMatch(row.body, /정리하고|천천히|옆에서|칸에서|표에서|맛집|음식점|식당|배달|배민|메뉴|맛있|포장|웨이팅|외식|교재비|병원비|경조사|잠자고/);
    for (const [name, re] of forbidden) {
      if (re.test(row.body)) forbiddenHits[name] += 1;
    }
    if (row.body.includes("잠자고 있던")) sleeping += 1;
    if (!/5만원|7만원|10만원|22만원|66만원|3건/.test(row.body)) noAmount += 1;
    assert.match(row.body, /유심\s*혜택/, `row ${row.rowId} benefit name`);
    assert.match(row.body, /확인/, `row ${row.rowId} checked the benefit`);
    assert.match(row.body, /받았|받음|필요해/, `row ${row.rowId} received the benefit`);
    assert.doesNotMatch(row.body, /통신사\s*실적/, `row ${row.rowId} must not narrate carrier performance`);
    assert.doesNotMatch(row.body, /가족에게/);
    assert.doesNotMatch(row.body, /안내 문구를 그대로 전달/);
    assert.doesNotMatch(row.body, /그대로 전달/);
    if (persona === "대학생") {
      assert.ok(bucket === "20s" || bucket === "30s", `row ${row.rowId} 대학생 age`);
      assert.equal(formal, false, `row ${row.rowId} 대학생 voice`);
    }
  }
  assert.ok(reviewTemplateCount() >= 120, `templates ${reviewTemplateCount()}`);
  assert.ok(noAmount >= 1200, `reviews without an amount: ${noAmount}`);
  assert.ok(sleeping <= 1, `잠자고 있던 count ${sleeping}`);
  for (const [name, count] of Object.entries(forbiddenHits)) {
    assert.equal(count, 0, `${name} remained in ${count} reviews`);
  }
  assert.ok(themed >= 9_500, `expected most rows to mention the benefit consult, got ${themed}`);
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

test("review sentences keep stored dates off the shared calendar stamp", () => {
  const rows = generateReviewRows(10_000);
  let stamped = 0;
  for (const row of rows) {
    assert.doesNotMatch(row.body, /\d+\s*분경/, `${row.rowId} has a minute stamp`);
    assert.doesNotMatch(row.body, /\d+\s*분/, `${row.rowId} has a clock minute`);
    assert.doesNotMatch(row.body, /corpus-/i, `${row.rowId} leaks corpus id`);
    assert.equal(reviewDateMismatch(row.body, row.publishedAt), null, `${row.rowId} date`);
    if (/\d{1,2}\s*월\s*\d{1,2}\s*일/.test(row.body)) stamped += 1;
  }
  assert.equal(stamped, 0, "calendar dates are stored on the row, not copied into every sentence");
  const lengths = rows.map(row => row.body.length);
  assert.ok(Math.min(...lengths) < 80, "some reviews stay short");
  assert.ok(Math.max(...lengths) < 120, "reviews stay short notes");
  assert.ok(lengths.filter((length) => length <= 90).length > 9000, "most reviews are one or two short sentences");
});

test("displayed review texts stay unique without a shared calendar stamp", () => {
  const today = new Date("2026-10-27T03:00:00.000Z");
  const rows = generateReviewRows(10_000);
  const shownBodies = new Set();
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
    assert.doesNotMatch(shown.body, /\d{1,2}\s*월\s*\d{1,2}\s*일/);
    assert.equal(shownBodies.has(shown.body), false, `duplicate displayed body ${row.rowId}`);
    shownBodies.add(shown.body);
  }
  assert.equal(shownBodies.size, 10_000);
});

test("generated reviews use distinct full sentences", async () => {
  const rows = generateReviewRows(10_000);
  const bodies = new Set(rows.map(row => row.body));
  assert.equal(bodies.size, 10_000);
  const { snippet } = await reviewHashes(rows[0].body);
  assert.equal(typeof snippet, "string");
});
