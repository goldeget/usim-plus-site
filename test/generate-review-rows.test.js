import assert from "node:assert/strict";
import { test } from "node:test";
import { generateReviewRows, ratingDistributionForCorpus } from "../scripts/generate-review-rows.mjs";
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, reviewHashes } from "../functions/_lib/reviews.js";

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
});
