import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createMemoryCloudflare } from "../test-support/cloudflare.js";
import { createAdminEnvironment, createAdminSessionHeaders } from "../test-support/admin-auth.js";

const imageBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x00, 0xff, 0xd9]);

function makeId(seed = "A") { return `UP-${seed.repeat(22)}`; }

async function seedSubmission(env, { id = makeId(), ageDays = 1, createdAt: suppliedCreatedAt, reviewedAt, status = "pending", sourceIpHash = null, imageHash = null } = {}) {
  const createdAt = suppliedCreatedAt || new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString();
  const objectKey = `pending/${id.slice(3)}.jpg`;
  env.rows.set(id, { id, token_hash: "a".repeat(64), object_key: objectKey, content_type: "image/jpeg", size_bytes: imageBytes.byteLength, status, source_ip_hash: sourceIpHash, image_hash: imageHash, created_at: createdAt, reviewed_at: status === "pending" ? null : (reviewedAt || createdAt) });
  await env.APPLICATIONS_BUCKET.put(objectKey, imageBytes, { httpMetadata: { contentType: "image/jpeg" }, customMetadata: { submissionId: id } });
  return env.rows.get(id);
}

async function callQueue(env, { headers = env.adminHeaders, cursor = "", status = "pending", id = "" } = {}) {
  const { onRequest } = await import("../functions/api/admin/applications.js");
  const query = new URLSearchParams();
  if (status !== "pending") query.set("status", status);
  if (cursor) query.set("cursor", cursor);
  if (id) query.set("id", id);
  return onRequest({ request: new Request(`https://admin.climekr.com/api/admin/applications${query.size ? `?${query}` : ""}`, { headers }), env });
}

async function callDashboard(env, headers = env.adminHeaders) {
  const { onRequest } = await import("../functions/api/admin/dashboard.js");
  return onRequest({ request: new Request("https://admin.climekr.com/api/admin/dashboard", { headers }), env });
}

async function callDuplicates(env, headers = env.adminHeaders, params = {}) {
  const { onRequest } = await import("../functions/api/admin/applications/duplicates.js");
  const query = new URLSearchParams(params);
  return onRequest({ request: new Request(`https://admin.climekr.com/api/admin/applications/duplicates${query.size ? `?${query}` : ""}`, { headers }), env });
}

async function callImage(env, id, headers = env.adminHeaders) {
  const { onRequest } = await import("../functions/api/admin/applications/image.js");
  return onRequest({ request: new Request(`https://admin.climekr.com/api/admin/applications/image?id=${encodeURIComponent(id)}`, { headers }), env });
}

async function callReview(env, id, decision, { headers = env.adminHeaders, origin = "https://admin.climekr.com" } = {}) {
  const { onRequest } = await import("../functions/api/admin/applications/review.js");
  return onRequest({
    request: new Request("https://admin.climekr.com/api/admin/applications/review", {
      method: "POST",
      headers: { ...headers, origin, "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision })
    }),
    env
  });
}

async function adminEnv(options) {
  const env = createAdminEnvironment({ cloudflare: createMemoryCloudflare(options), email: "admin@example.test" });
  env.adminHeaders = await createAdminSessionHeaders(env);
  return env;
}

test("denies queue, image, and decision requests without an application session", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env);
  assert.equal((await callQueue(env, { headers: {} })).status, 401);
  assert.equal((await callImage(env, row.id, {})).status, 401);
  assert.equal((await callReview(env, row.id, "approved", { headers: {} })).status, 401);
});

test("protects dashboard and duplicate signal APIs with the admin session", async () => {
  const env = await adminEnv();
  assert.equal((await callDashboard(env, {})).status, 401);
  assert.equal((await callDuplicates(env, {})).status, 401);
});

test("summarizes work due, recent decisions, and duplicate groups for the dashboard", async () => {
  const env = await adminEnv();
  await seedSubmission(env, { id: makeId("S"), sourceIpHash: "4".repeat(64), imageHash: "5".repeat(64) });
  await seedSubmission(env, { id: makeId("T"), sourceIpHash: "4".repeat(64), imageHash: "6".repeat(64) });
  await seedSubmission(env, { id: makeId("U"), status: "approved" });
  await seedSubmission(env, { id: makeId("V"), status: "rejected" });
  const response = await callDashboard(env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.stats, { pending: 2, approvedLast7Days: 1, rejectedLast7Days: 1, duplicateGroups: 1 });
  assert.ok(data.asOf);
});

test("filters application history without exposing hashes or private R2 keys", async () => {
  const env = await adminEnv();
  await seedSubmission(env, { id: makeId("M"), status: "approved", sourceIpHash: "b".repeat(64), imageHash: "c".repeat(64) });
  await seedSubmission(env, { id: makeId("N"), status: "rejected" });
  const response = await callQueue(env, { status: "approved" });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.items.map(item => item.status), ["approved"]);
  assert.equal("sourceIpHash" in data.items[0], false);
  assert.equal("imageHash" in data.items[0], false);
  assert.equal("objectKey" in data.items[0], false);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const allResponse = await callQueue(env, { status: "all" });
  const all = await allResponse.json();
  assert.deepEqual(new Set(all.items.map(item => item.status)), new Set(["approved", "rejected"]));
});

test("orders approved history by decision time instead of when the application arrived", async () => {
  const env = await adminEnv();
  const now = Date.now();
  const approvedEarlier = await seedSubmission(env, {
    id: makeId("J"), status: "approved", ageDays: 10,
    reviewedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString()
  });
  await seedSubmission(env, {
    id: makeId("K"), status: "approved", ageDays: 2,
    reviewedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
  });
  const data = await (await callQueue(env, { status: "approved" })).json();
  assert.equal(data.items[0].id, approvedEarlier.id);
});

test("keeps expired pending submissions visible in retained history without offering a photo review", async () => {
  const env = await adminEnv();
  const oldPending = await seedSubmission(env, { id: makeId("e"), ageDays: 45 });
  const pendingData = await (await callQueue(env)).json();
  assert.equal(pendingData.items.length, 0);

  const all = await (await callQueue(env, { status: "all" })).json();
  assert.equal(all.items.length, 1);
  assert.equal(all.items[0].id, oldPending.id);
  assert.equal(all.items[0].photoExpired, true);
});

test("finds one retained application by exact receipt number without bypassing retention", async () => {
  const env = await adminEnv();
  const approved = await seedSubmission(env, { id: makeId("L"), status: "approved" });
  const pendingExpired = await seedSubmission(env, { id: makeId("M"), ageDays: 45 });
  await seedSubmission(env, { id: makeId("N"), status: "rejected" });

  const approvedResult = await (await callQueue(env, { status: "all", id: approved.id })).json();
  assert.deepEqual(approvedResult.items.map(item => item.id), [approved.id]);
  assert.equal(approvedResult.nextCursor, null);

  const expiredResult = await (await callQueue(env, { status: "all", id: pendingExpired.id })).json();
  assert.deepEqual(expiredResult.items.map(item => item.id), [pendingExpired.id]);
  assert.equal(expiredResult.items[0].photoExpired, true);
  assert.equal((await callQueue(env, { status: "all", id: "UP-invalid" })).status, 400);
});

test("preserves case-sensitive Base64URL characters in receipt numbers", async () => {
  const env = await adminEnv();
  const id = `UP-${"aB".repeat(11)}`;
  await seedSubmission(env, { id, status: "approved" });
  const result = await (await callQueue(env, { status: "all", id })).json();
  assert.deepEqual(result.items.map(item => item.id), [id]);
});

test("opens one selected pending application directly from duplicate review", async () => {
  const env = await adminEnv();
  const selected = await seedSubmission(env, { id: makeId("W"), sourceIpHash: "7".repeat(64) });
  await seedSubmission(env, { id: makeId("X") });
  const response = await callQueue(env, { id: selected.id });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.items.map(item => item.id), [selected.id]);
  assert.equal(data.nextCursor, null);
  assert.equal((await callQueue(env, { id: "invalid-id" })).status, 400);
});

test("groups duplicate review signals without revealing fingerprints or deciding outcomes", async () => {
  const env = await adminEnv();
  const sharedIp = "1".repeat(64);
  const sharedPhoto = "2".repeat(64);
  const first = await seedSubmission(env, { id: makeId("P"), sourceIpHash: sharedIp, imageHash: sharedPhoto });
  const second = await seedSubmission(env, { id: makeId("Q"), sourceIpHash: sharedIp, imageHash: "3".repeat(64) });
  const third = await seedSubmission(env, { id: makeId("R"), sourceIpHash: null, imageHash: sharedPhoto });
  const response = await callDuplicates(env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.groups.length, 2);
  const ipGroup = data.groups.find(group => group.type === "same_ip");
  const imageGroup = data.groups.find(group => group.type === "same_image");
  const ipPage = await (await callDuplicates(env, env.adminHeaders, { type: ipGroup.type, reference: ipGroup.referenceId })).json();
  const imagePage = await (await callDuplicates(env, env.adminHeaders, { type: imageGroup.type, reference: imageGroup.referenceId })).json();
  assert.deepEqual(new Set(ipPage.applications.map(item => item.id)), new Set([first.id, second.id]));
  assert.deepEqual(new Set(imagePage.applications.map(item => item.id)), new Set([first.id, third.id]));
  assert.equal(ipGroup.count, 2);
  assert.equal(imageGroup.count, 2);
  assert.equal(JSON.stringify(data).includes(sharedIp), false);
  assert.equal(JSON.stringify(data).includes(sharedPhoto), false);
  assert.equal(JSON.stringify(data).includes("pending/"), false);
  assert.equal(data.groups.every(group => group.applications.every(item => item.status === "pending")), true);
  assert.match(data.disclaimer, /동일인.*단정|동일인.*증거/);
});

test("paginates every application in a large duplicate group without exposing its comparison value", async () => {
  const env = await adminEnv();
  const photoFingerprint = "9".repeat(64);
  for (let index = 0; index < 101; index += 1) {
    const id = `UP-${String(index).padStart(22, "0")}`;
    await seedSubmission(env, { id, imageHash: photoFingerprint });
  }

  const first = await (await callDuplicates(env)).json();
  const group = first.groups.find(item => item.type === "same_image");
  assert.equal(group.count, 101);
  assert.equal(group.applications.length, 0);
  assert.equal(JSON.stringify(first).includes(photoFingerprint), false);

  const firstPageResponse = await callDuplicates(env, env.adminHeaders, {
    type: group.type,
    reference: group.referenceId
  });
  const firstPage = await firstPageResponse.json();
  assert.equal(firstPageResponse.status, 200);
  assert.equal(firstPage.applications.length, 50);
  assert.ok(firstPage.nextCursor);

  const secondResponse = await callDuplicates(env, env.adminHeaders, {
    type: group.type,
    reference: group.referenceId,
    cursor: firstPage.nextCursor
  });
  const secondPage = await secondResponse.json();
  assert.equal(secondResponse.status, 200);
  assert.equal(secondPage.applications.length, 50);
  assert.ok(secondPage.nextCursor);

  const thirdResponse = await callDuplicates(env, env.adminHeaders, {
    type: group.type,
    reference: group.referenceId,
    cursor: secondPage.nextCursor
  });
  const thirdPage = await thirdResponse.json();
  assert.equal(thirdResponse.status, 200);
  assert.equal(thirdPage.applications.length, 1);
  assert.equal(thirdPage.nextCursor, null);
  assert.equal(new Set([...firstPage.applications, ...secondPage.applications, ...thirdPage.applications].map(item => item.id)).size, 101);
  assert.equal(JSON.stringify(secondPage).includes(photoFingerprint), false);
});

test("paginates tied duplicate records in SQLite binary ID order", async () => {
  const env = await adminEnv();
  const sharedImage = "6".repeat(64);
  const createdAt = new Date(Date.now() - 60_000).toISOString();
  const ids = [..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".slice(0, 51)].map(character => `UP-${character.repeat(22)}`);
  for (const id of ids) await seedSubmission(env, { id, createdAt, imageHash: sharedImage });
  const group = (await (await callDuplicates(env)).json()).groups.find(item => item.type === "same_image");
  const first = await (await callDuplicates(env, env.adminHeaders, { type: group.type, reference: group.referenceId })).json();
  const second = await (await callDuplicates(env, env.adminHeaders, { type: group.type, reference: group.referenceId, cursor: first.nextCursor })).json();
  const expected = [...ids].sort((a, b) => a < b ? 1 : a > b ? -1 : 0);
  assert.deepEqual(first.applications.map(item => item.id), expected.slice(0, 50));
  assert.deepEqual(second.applications.map(item => item.id), expected.slice(50));
  assert.equal(second.nextCursor, null);
});

test("finds duplicate signals for queue items beyond the first group page", async () => {
  const env = await adminEnv();
  const sharedIp = "8".repeat(64);
  const sharedImage = "7".repeat(64);
  const ids = [];
  for (let index = 0; index < 101; index += 1) {
    const id = `UP-${String(index).padStart(22, "0")}`;
    ids.push(id);
    await seedSubmission(env, { id, sourceIpHash: sharedIp, imageHash: sharedImage });
  }
  const latestGroup = (await (await callDuplicates(env)).json()).groups.find(group => group.type === "same_image");
  assert.equal(latestGroup.count, 101);
  const response = await callDuplicates(env, env.adminHeaders, { applications: ids[0] });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.items, [{ id: ids[0], signals: ["same_ip", "same_image"] }]);
  assert.equal(JSON.stringify(data).includes(sharedIp), false);
  assert.equal(JSON.stringify(data).includes(sharedImage), false);
});

test("rejects malformed duplicate group pagination parameters", async () => {
  const env = await adminEnv();
  const invalidType = await callDuplicates(env, env.adminHeaders, { type: "sql", reference: makeId("1"), cursor: "abc" });
  const invalidId = await callDuplicates(env, env.adminHeaders, { type: "same_ip", reference: "not-an-id", cursor: "abc" });
  const invalidCursor = await callDuplicates(env, env.adminHeaders, { type: "same_ip", reference: makeId("1"), cursor: "not valid" });
  assert.equal(invalidType.status, 400);
  assert.equal(invalidId.status, 400);
  assert.equal(invalidCursor.status, 400);
});

test("ignores forged Cloudflare Access headers without an application session", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env);
  const headers = { "cf-access-authenticated-user-email": "admin@example.test", "cf-access-jwt-assertion": "forged" };
  assert.equal((await callQueue(env, { headers })).status, 401);
  assert.equal((await callImage(env, row.id, headers)).status, 401);
  assert.equal((await callReview(env, row.id, "approved", { headers })).status, 401);
});

test("lists only fresh pending items without exposing R2 keys or receipt hashes", async () => {
  const env = await adminEnv();
  const pending = await seedSubmission(env, { id: makeId("B") });
  await seedSubmission(env, { id: makeId("C"), ageDays: 31 });
  await seedSubmission(env, { id: makeId("D"), status: "approved" });
  const response = await callQueue(env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.items.length, 1);
  assert.deepEqual(data.items[0], {
    id: pending.id,
    status: "pending",
    createdAt: pending.created_at,
    contentType: "image/jpeg",
    sizeBytes: imageBytes.byteLength
  });
  assert.equal(JSON.stringify(data).includes("object_key"), false);
  assert.equal(JSON.stringify(data).includes("token_hash"), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("paginates application history into bounded pages without skipping same-time submissions", async () => {
  const env = await adminEnv();
  const createdAt = new Date().toISOString();
  for (let i = 0; i < 21; i += 1) {
    const id = `UP-${String(i).padStart(22, "0")}`;
    env.rows.set(id, { id, token_hash: "a".repeat(64), object_key: `pending/${i}.jpg`, content_type: "image/jpeg", size_bytes: 8, status: "pending", created_at: createdAt, reviewed_at: null });
  }
  const first = await (await callQueue(env)).json();
  assert.equal(first.items.length, 10);
  assert.ok(first.nextCursor);
  const second = await (await callQueue(env, { cursor: first.nextCursor })).json();
  assert.equal(second.items.length, 10);
  assert.ok(second.nextCursor);
  const third = await (await callQueue(env, { cursor: second.nextCursor })).json();
  assert.equal(third.items.length, 1);
  assert.equal(third.items[0].id, `UP-${String(20).padStart(22, "0")}`);
  assert.equal(third.nextCursor, null);
});

test("serves an original image only to an authorized administrator with private headers", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("E") });
  const response = await callImage(env, row.id);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), imageBytes);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-disposition"), /inline/);
});

test("blocks reviewed images after the 30-day decision retention even before R2 cleanup", async () => {
  const env = await adminEnv();
  for (const status of ["approved", "rejected"]) {
    const row = await seedSubmission(env, { id: makeId(status === "approved" ? "Y" : "Z"), status, ageDays: 31 });
    const response = await callImage(env, row.id);
    assert.equal(response.status, 410);
    assert.equal(env.objects.has(row.object_key), true);
  }
});

test("serves reviewed images while they remain inside the decision retention period", async () => {
  const env = await adminEnv();
  for (const status of ["approved", "rejected"]) {
    const row = await seedSubmission(env, { id: makeId(status === "approved" ? "a" : "b"), status, ageDays: 29 });
    assert.equal((await callImage(env, row.id)).status, 200);
  }
});

test("approves a pending photo once and starts a fresh 30-day R2 object age", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("F"), ageDays: 20 });
  const response = await callReview(env, row.id, "approved");
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, "approved");
  assert.ok(result.reviewedAt);
  assert.equal(row.status, "approved");
  assert.match(row.object_key, /^reviewed\//);
  assert.equal(env.objects.has(row.object_key), true);
  assert.equal(env.objects.has(`pending/${row.id.slice(3)}.jpg`), false);
});

test("rejects wrong origins and invalid decisions without changing the queue", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("G") });
  assert.equal((await callReview(env, row.id, "approved", { origin: "https://evil.example" })).status, 401);
  assert.equal((await callReview(env, row.id, "pending")).status, 400);
  assert.equal(row.status, "pending");
});

test("bounds the admin decision body stream when Content-Length is missing", async () => {
  const env = await adminEnv();
  const { onRequest } = await import("../functions/api/admin/applications/review.js");
  let cancelled = false;
  let closeTimer;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1025));
      closeTimer = setTimeout(() => controller.close(), 50);
    },
    cancel() { cancelled = true; clearTimeout(closeTimer); }
  });
  const request = new Request("https://admin.climekr.com/api/admin/applications/review", {
    method: "POST",
    headers: { ...env.adminHeaders, origin: "https://admin.climekr.com", "Content-Type": "application/json" },
    body: stream,
    duplex: "half"
  });
  const response = await onRequest({ request, env });
  assert.equal(request.headers.has("content-length"), false);
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
});

test("does not allow a second, different review decision", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("H") });
  assert.equal((await callReview(env, row.id, "approved")).status, 200);
  assert.equal((await callReview(env, row.id, "rejected")).status, 409);
  assert.equal(row.status, "approved");
});

test("removes the copied object if the conditional D1 decision fails", async () => {
  const env = await adminEnv({ failUpdate: true });
  const row = await seedSubmission(env, { id: makeId("I") });
  const response = await callReview(env, row.id, "rejected");
  assert.equal(response.status, 503);
  assert.equal(row.status, "pending");
  assert.equal([...env.objects.keys()].filter(key => key.startsWith("reviewed/")).length, 0);
});

test("preserves the reviewed image if D1 commits before its response fails", async () => {
  const env = await adminEnv({ failUpdateAfterCommit: true });
  const row = await seedSubmission(env, { id: makeId("L") });
  const response = await callReview(env, row.id, "approved");
  assert.equal(response.status, 200);
  assert.equal(row.status, "approved");
  assert.equal(env.objects.has(row.object_key), true);
});

test("leaves no losing photo copy after concurrent conflicting decisions", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("J") });
  const responses = await Promise.all([
    callReview(env, row.id, "approved"),
    callReview(env, row.id, "rejected")
  ]);
  const statuses = responses.map(response => response.status).sort();
  assert.deepEqual(statuses, [200, 409]);
  assert.ok(["approved", "rejected"].includes(row.status));
  assert.equal([...env.objects.keys()].filter(key => key.startsWith("reviewed/")).length, 1);
  assert.equal(env.objects.has(row.object_key), true);
});

test("does not change the decision if copying the image into reviewed retention fails", async () => {
  const env = await adminEnv();
  const row = await seedSubmission(env, { id: makeId("K") });
  env.failures.put = true;
  const response = await callReview(env, row.id, "approved");
  assert.equal(response.status, 503);
  assert.equal(row.status, "pending");
});

test("provides an accessible review queue, image dialog, and explicit decision controls", async () => {
  const html = await readFile(new URL("../public/admin/review.html", import.meta.url), "utf8");
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<dialog\b/);
  assert.match(html, /\/api\/admin\/applications\/image\?id=/);
  assert.match(html, /\/api\/admin\/applications\/review/);
  assert.match(html, /승인/);
  assert.match(html, /반려/);
  assert.match(html, /더 불러오기/);
  assert.match(html, /duplicateSignalFailures/);
  assert.match(html, /approve\.disabled=signalsUnavailable;reject\.disabled=signalsUnavailable/);
  assert.match(html, /nextCard\.focus\(\{preventScroll:true\}\)/);
  assert.match(html, /min-width:72px;white-space:nowrap/);
});

test("links the protected content editor to photo review", async () => {
  const html = await readFile(new URL("../public/admin/index.html", import.meta.url), "utf8");
  assert.match(html, /review\.html/);
  assert.match(html, /review\.html\?focus=/);
});

test("provides dashboard, history, duplicate review, and the preserved editor inside the admin shell", async () => {
  const [dashboard, history, duplicates, content, shell, styles, applicationStyles] = await Promise.all([
    readFile(new URL("../public/admin/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/admin/applications.html", import.meta.url), "utf8"),
    readFile(new URL("../public/admin/duplicates.html", import.meta.url), "utf8"),
    readFile(new URL("../public/admin/content.html", import.meta.url), "utf8"),
    readFile(new URL("../public/admin/admin-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../public/admin/admin-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../public/admin/applications.css", import.meta.url), "utf8")
  ]);
  assert.match(dashboard, /\/api\/admin\/dashboard/);
  assert.match(history, /status=pending|URLSearchParams/);
  assert.match(history, /id="applicationSearch"/);
  assert.match(history, /id="previousPage"/);
  assert.match(history, /id="nextPage"/);
  assert.match(history, /cursorStack\[pageIndex \+ 1\] = nextCursor/);
  assert.match(history, /rawValue\.slice\(3\)/);
  assert.doesNotMatch(history, /searchInput\.value\.trim\(\)\.toUpperCase\(\)/);
  assert.match(history, /setControlsBusy\(true\)/);
  assert.match(history, /preserveRows: true, rollback/);
  assert.doesNotMatch(history, /id="loadMore"/);
  assert.match(duplicates, /\/api\/admin\/applications\/duplicates/);
  assert.match(content, /id="editor"/);
  assert.match(shell, /aria-expanded/);
  assert.match(shell, /data-admin-menu-close/);
  assert.match(shell, /sidebarCloseButton\.addEventListener\("click",\s*closeMenu\)/);
  assert.match(shell, /title: "현황"/);
  for (const href of ["/", "/admin/review.html", "/admin/applications.html", "/admin/duplicates.html", "/admin/content.html"]) assert.ok(shell.includes(href), `missing navigation destination ${href}`);
  assert.match(styles, /min-height:\s*44px|--admin-touch-target:\s*44px/);
  assert.match(styles, /admin-sidebar-close[^}]*width:44px/);
  assert.match(styles, /@media\s*\(max-width:\s*\d+px\)/);
  assert.match(applicationStyles, /@media\s*\(max-width:900px\)/);
});
