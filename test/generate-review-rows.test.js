import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageBucketForIndex,
  generateReviewRows,
  isFormalAgeBucket,
  ratingDistributionForCorpus
} from "../scripts/generate-review-rows.mjs";
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_INTERNAL_ID_PATTERN,
  reviewHashes
} from "../functions/_lib/reviews.js";

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

test("generated corpus voice: hardship/prepaid theme and age buckets", () => {
  const rows = generateReviewRows(10_000);
  const themeRe =
    /대출|급전|선불\s*유심|생활비|자금|카드\s*한도|통장|병원|학자금|신용|막힌|부족|빠듯|지출|보태|줄어|공백|전세|몰랐|처음\s*알/;
  const telecomOnlyLead = /^[^.]{0,80}(번호\s*이동|신규\s*개통)\s*관련으로만/;
  let themed = 0;
  let formalRows = 0;
  let casualWithEmoticon = 0;
  let formalWithEmoticon = 0;
  const bucketCounts = { "20s": 0, "30s": 0, "40s": 0, "50s": 0, "60s": 0, "70s": 0 };
  for (let i = 1; i <= 10_000; i += 1) {
    const bucket = ageBucketForIndex(i);
    bucketCounts[bucket] += 1;
  }
  for (const row of rows) {
    const idx = Number(row.rowId);
    const bucket = ageBucketForIndex(idx);
    assert.equal(bucketCounts[bucket] > 0, true);
    if (themeRe.test(row.body)) themed += 1;
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
  }
  assert.ok(themed >= 9_500, `expected most rows to mention hardship/prepaid theme, got ${themed}`);
  assert.ok(
    Math.abs(formalRows - 10_000 / 2) <= 1,
    `~half of rows use 50s–70s formal voice (got ${formalRows})`
  );
  assert.equal(formalWithEmoticon, 0, "formal age buckets should not use emoticons");
  assert.ok(casualWithEmoticon > 100 && casualWithEmoticon < 5_000, "some casual rows include emoticons");
  for (const n of Object.values(bucketCounts)) {
    assert.ok(Math.abs(n - 10_000 / 6) <= 2, "age buckets evenly split");
  }
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
