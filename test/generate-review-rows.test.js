import assert from "node:assert/strict";
import { test } from "node:test";
import { generateReviewRows } from "../scripts/generate-review-rows.mjs";
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
  assert.ok(rows.every(r => r.rating === 5), "corpus uses 5-star ratings only");
  const featured = rows.filter(r => r.featured);
  assert.equal(featured.length, 24);
  assert.ok(featured.every(r => r.sortBoost > 0));
});
