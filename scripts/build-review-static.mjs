/**
 * Write the public review corpus as static JSON (git + Pages).
 * No D1 inserts. Slots stay 0..9999; the reader maps 50 of them to "today".
 *
 *   node scripts/build-review-static.mjs
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeSnippet } from "../functions/_lib/reviews.js";
import {
  REVIEW_CHUNK_COUNT,
  REVIEW_CHUNK_SIZE,
  REVIEW_SLOT_COUNT,
  kstDateKey,
  reviewDateMismatch,
  reviewIdForSlot
} from "../functions/_lib/review-dates.js";
import { REVIEW_CORPUS_VERSION, generateReviewRows, ratingDistributionForCorpus } from "./generate-review-rows.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/reviews/data");
const listDir = path.join(root, "list");
const bodyDir = path.join(root, "bodies");

const rows = generateReviewRows(REVIEW_SLOT_COUNT);
if (rows.length !== REVIEW_SLOT_COUNT) {
  throw new Error(`expected ${REVIEW_SLOT_COUNT} rows, got ${rows.length}`);
}

const expected = ratingDistributionForCorpus(REVIEW_SLOT_COUNT);
const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const listChunks = Array.from({ length: REVIEW_CHUNK_COUNT }, () => []);
const bodyChunks = Array.from({ length: REVIEW_CHUNK_COUNT }, () => []);
const rating3 = [];
let ratingSum = 0;

for (let slot = 0; slot < rows.length; slot += 1) {
  const row = rows[slot];
  if (Number(row.rowId) !== slot + 1) throw new Error(`slot ${slot} does not match row ${row.rowId}`);
  const mismatch = reviewDateMismatch(row.body, row.publishedAt);
  if (mismatch) throw new Error(`row ${row.rowId} date phrase: ${mismatch}`);
  if (/corpus-\d{5}/i.test(row.body) || /\d+\s*분경/.test(row.body)) {
    throw new Error(`row ${row.rowId} contains a forbidden stamp`);
  }
  if (/corpus-\d{5}/i.test(row.displayName)) throw new Error(`row ${row.rowId} display name is internal`);
  const snippet = makeSnippet(row.body);
  if (/corpus-\d{5}/i.test(snippet) || /\d+\s*분경/.test(snippet)) {
    throw new Error(`row ${row.rowId} snippet contains a forbidden stamp`);
  }
  histogram[row.rating] += 1;
  ratingSum += row.rating;
  const record = {
    id: reviewIdForSlot(slot),
    slot,
    rating: row.rating,
    displayName: row.displayName,
    basePublishedAt: row.publishedAt,
    baseSeoulDate: kstDateKey(row.publishedAt),
    snippet,
    tags: row.tags,
    featured: row.featured ? 1 : 0
  };
  const chunk = Math.floor(slot / REVIEW_CHUNK_SIZE);
  listChunks[chunk].push(record);
  bodyChunks[chunk].push({ id: record.id, slot, body: row.body });
  if (row.rating === 3) rating3.push(record);
}

if (histogram[3] !== expected[3] || histogram[4] !== expected[4] || histogram[5] !== expected[5]) {
  throw new Error(`rating histogram ${JSON.stringify(histogram)} != ${JSON.stringify(expected)}`);
}
const avgRating = Math.round((ratingSum / rows.length) * 10) / 10;
if (avgRating !== 4.8) throw new Error(`average rating ${avgRating} !== 4.8`);

for (let chunk = 0; chunk < REVIEW_CHUNK_COUNT; chunk += 1) {
  if (listChunks[chunk].length !== REVIEW_CHUNK_SIZE) {
    throw new Error(`list chunk ${chunk} has ${listChunks[chunk].length} rows`);
  }
}

rating3.sort((a, b) => b.slot - a.slot);

const chunkMeta = listChunks.map((items, chunk) => ({
  chunk,
  minDate: items[0].baseSeoulDate,
  maxDate: items.at(-1).baseSeoulDate,
  baseStart: items[0].basePublishedAt,
  baseEnd: items.at(-1).basePublishedAt
}));

const meta = {
  version: 1,
  corpus: REVIEW_CORPUS_VERSION,
  count: rows.length,
  chunkSize: REVIEW_CHUNK_SIZE,
  chunkCount: REVIEW_CHUNK_COUNT,
  builtAt: new Date().toISOString(),
  avgRating,
  histogram: {
    1: histogram[1],
    2: histogram[2],
    3: histogram[3],
    4: histogram[4],
    5: histogram[5]
  },
  baseStart: rows[0].publishedAt,
  baseEnd: rows.at(-1).publishedAt,
  chunks: chunkMeta
};

await mkdir(listDir, { recursive: true });
await mkdir(bodyDir, { recursive: true });

const writes = [
  writeFile(path.join(root, "meta.json"), JSON.stringify(meta)),
  writeFile(path.join(root, "rating-3.json"), JSON.stringify({ items: rating3 }))
];
for (let chunk = 0; chunk < REVIEW_CHUNK_COUNT; chunk += 1) {
  const name = `c${String(chunk).padStart(3, "0")}.json`;
  writes.push(writeFile(path.join(listDir, name), JSON.stringify({ chunk, items: listChunks[chunk] })));
  writes.push(writeFile(path.join(bodyDir, name), JSON.stringify({ chunk, items: bodyChunks[chunk] })));
}
await Promise.all(writes);

async function bytes(file) {
  return (await stat(file)).size;
}
const metaBytes = await bytes(path.join(root, "meta.json"));
const ratingBytes = await bytes(path.join(root, "rating-3.json"));
let listBytes = 0;
let bodyBytes = 0;
for (let chunk = 0; chunk < REVIEW_CHUNK_COUNT; chunk += 1) {
  const name = `c${String(chunk).padStart(3, "0")}.json`;
  listBytes += await bytes(path.join(listDir, name));
  bodyBytes += await bytes(path.join(bodyDir, name));
}
const total = metaBytes + ratingBytes + listBytes + bodyBytes;
console.log(`Wrote ${rows.length} reviews to ${root}`);
console.log(`avg ${avgRating}, histogram ${JSON.stringify(meta.histogram)}`);
console.log(`base ${meta.baseStart} → ${meta.baseEnd}`);
console.log(
  `bytes meta=${metaBytes} rating3=${ratingBytes} list=${listBytes} bodies=${bodyBytes} total=${total}`
);
