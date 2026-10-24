export function createMemoryCloudflare({ failInsert = false, failPut = false, failDelete = false, failUpdate = false, failUpdateAfterCommit = false, failRead = false } = {}) {
  const rows = new Map();
  const siteContent = new Map();
  const objects = new Map();
  const adminSessions = new Map();
  const adminLoginAttempts = new Map();
  const failures = { insert: failInsert, put: failPut, delete: failDelete, update: failUpdate, updateAfterCommit: failUpdateAfterCommit, read: failRead };
  const db = {
    rows,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (failures.read) throw new Error("injected D1 read failure");
              if (/FROM admin_sessions\s+WHERE token_hash\s*=\s*\?/i.test(sql)) {
                const row = adminSessions.get(values[0]);
                return row ? { ...row } : null;
              }
              if (/FROM admin_login_attempts\s+WHERE ip_hash\s*=\s*\?/i.test(sql)) {
                const row = adminLoginAttempts.get(values[0]);
                return row ? { ...row } : null;
              }
              if (/FROM site_content\s+WHERE id\s*=\s*\?/i.test(sql)) {
                const row = siteContent.get(values[0]);
                return row ? { ...row } : null;
              }
              if (/INSERT INTO admin_login_attempts/i.test(sql) && /RETURNING attempts/i.test(sql)) {
                const [ipHash, windowStartedAt, updatedAt, firstCutoff, secondCutoff] = values;
                const previous = adminLoginAttempts.get(ipHash);
                const expired = !previous || previous.window_started_at <= firstCutoff || previous.window_started_at <= secondCutoff;
                const row = expired
                  ? { ip_hash: ipHash, window_started_at: windowStartedAt, attempts: 1, updated_at: updatedAt }
                  : { ...previous, attempts: previous.attempts + 1, updated_at: updatedAt };
                adminLoginAttempts.set(ipHash, row);
                return { attempts: row.attempts };
              }
              if (/FROM application_submissions\s+WHERE id\s*=\s*\?/i.test(sql)) {
                const row = rows.get(values[0]);
                return row ? { ...row } : null;
              }
              if (/AS pending_count/i.test(sql) && /AS approved_count/i.test(sql) && /AS rejected_count/i.test(sql)) {
                const [pendingCutoff, approvedCutoff, rejectedCutoff] = values;
                return {
                  pending_count: [...rows.values()].filter(row => row.status === "pending" && row.created_at > pendingCutoff).length,
                  approved_count: [...rows.values()].filter(row => row.status === "approved" && row.reviewed_at > approvedCutoff).length,
                  rejected_count: [...rows.values()].filter(row => row.status === "rejected" && row.reviewed_at > rejectedCutoff).length
                };
              }
              return null;
            },
            async all() {
              if (/SELECT type, fingerprint, COUNT\(\*\) AS count/i.test(sql) && /GROUP BY type, fingerprint/i.test(sql)) {
                const [ipPendingCutoff, ipReviewedCutoff, imagePendingCutoff, imageReviewedCutoff] = values;
                const signalGroups = new Map();
                for (const row of rows.values()) {
                  const retained = (row.status === "pending" && row.created_at > ipPendingCutoff) || (["approved", "rejected"].includes(row.status) && row.reviewed_at > ipReviewedCutoff);
                  if (!retained) continue;
                  for (const [type, fingerprint] of [["same_ip", row.source_ip_hash], ["same_image", row.image_hash]]) {
                    if (!fingerprint) continue;
                    const key = `${type}\u0000${fingerprint}`;
                    if (!signalGroups.has(key)) signalGroups.set(key, { type, fingerprint, count: 0, latest_created_at: "", reference_id: "" });
                    const group = signalGroups.get(key);
                    group.count += 1;
                    if (row.created_at > group.latest_created_at) group.latest_created_at = row.created_at;
                    if (row.id > group.reference_id) group.reference_id = row.id;
                  }
                }
                const results = [...signalGroups.values()]
                  .filter(group => group.count > 1)
                  .sort((a, b) => b.latest_created_at.localeCompare(a.latest_created_at) || (a.reference_id < b.reference_id ? 1 : a.reference_id > b.reference_id ? -1 : 0));
                return { results };
              }
              if (/SELECT id, status, created_at, reviewed_at, source_ip_hash, image_hash FROM application_submissions WHERE id IN/i.test(sql)) {
                const selected = new Set(values);
                const results = [...rows.values()]
                  .filter(row => selected.has(row.id))
                  .map(({ id, status, created_at, reviewed_at, source_ip_hash, image_hash }) => ({ id, status, created_at, reviewed_at, source_ip_hash, image_hash }));
                return { results };
              }
              if (/SELECT id, source_ip_hash, image_hash FROM application_submissions WHERE \(source_ip_hash IN/i.test(sql)) {
                const ipCount = (sql.match(/source_ip_hash IN \(([^)]*)\)/)?.[1].match(/\?/g) || []).length;
                const imageCount = (sql.match(/image_hash IN \(([^)]*)\)/)?.[1].match(/\?/g) || []).length;
                const ipHashes = new Set(values.slice(0, ipCount));
                const imageHashes = new Set(values.slice(ipCount, ipCount + imageCount));
                const [pendingCutoff, reviewedCutoff] = values.slice(ipCount + imageCount);
                const results = [...rows.values()]
                  .filter(row => ipHashes.has(row.source_ip_hash) || imageHashes.has(row.image_hash))
                  .filter(row => (row.status === "pending" && row.created_at > pendingCutoff) || (["approved", "rejected"].includes(row.status) && row.reviewed_at > reviewedCutoff))
                  .map(({ id, source_ip_hash, image_hash }) => ({ id, source_ip_hash, image_hash }));
                return { results };
              }
              if (/SELECT id, status, created_at, reviewed_at, content_type, size_bytes FROM application_submissions WHERE (source_ip_hash|image_hash) = \?/i.test(sql)) {
                const [fingerprint, pendingCutoff, reviewedCutoff] = values;
                const column = /WHERE source_ip_hash = \?/i.test(sql) ? "source_ip_hash" : "image_hash";
                const hasCursor = /created_at < \?/i.test(sql);
                const cursorTime = hasCursor ? values[3] : null;
                const cursorId = hasCursor ? values[5] : null;
                const limit = values[values.length - 1];
                const results = [...rows.values()]
                  .filter(row => row[column] === fingerprint)
                  .filter(row => (row.status === "pending" && row.created_at > pendingCutoff) || (["approved", "rejected"].includes(row.status) && row.reviewed_at > reviewedCutoff))
                  .filter(row => !hasCursor || row.created_at < cursorTime || (row.created_at === cursorTime && row.id < cursorId))
                  .sort((a, b) => b.created_at.localeCompare(a.created_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
                  .slice(0, limit)
                  .map(({ id, status, created_at, reviewed_at, content_type, size_bytes }) => ({ id, status, created_at, reviewed_at, content_type, size_bytes }));
                return { results };
              }
              if (/source_ip_hash, image_hash/i.test(sql) && /FROM application_submissions/i.test(sql)) {
                const [pendingCutoff, reviewedCutoff, limit] = values;
                const results = [...rows.values()]
                  .filter(row => (row.status === "pending" && row.created_at > pendingCutoff) || (["approved", "rejected"].includes(row.status) && row.reviewed_at > reviewedCutoff))
                  .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
                  .slice(0, limit)
                  .map(({ id, status, created_at, reviewed_at, content_type, size_bytes, source_ip_hash, image_hash }) => ({ id, status, created_at, reviewed_at, content_type, size_bytes, source_ip_hash, image_hash }));
                return { results };
              }
              if (/FROM application_submissions/i.test(sql) && /WHERE status = 'pending'/i.test(sql)) {
                const [cutoff, cursorTime, , , cursorId, limit] = values;
                const results = [...rows.values()]
                  .filter(row => row.status === "pending" && row.created_at > cutoff)
                  .filter(row => !cursorTime || row.created_at > cursorTime || (row.created_at === cursorTime && row.id > cursorId))
                  .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
                  .slice(0, limit)
                  .map(({ id, status, created_at, content_type, size_bytes }) => ({ id, status, created_at, content_type, size_bytes }));
                return { results };
              }
              if (/SELECT id, status, created_at, reviewed_at/i.test(sql) && /FROM application_submissions/i.test(sql)) {
                const [status, pendingCutoff, reviewedCutoff, , , , , cursorTime, , , cursorId, limit] = values;
                const eligible = row => status === "all"
                  ? (row.status === "pending" && row.created_at > reviewedCutoff) || (["approved", "rejected"].includes(row.status) && row.reviewed_at > reviewedCutoff)
                  : row.status === status && row.reviewed_at > reviewedCutoff;
                const results = [...rows.values()]
                  .filter(eligible)
                  .filter(row => {
                    const sortAt = row.reviewed_at || row.created_at;
                    return !cursorTime || sortAt < cursorTime || (sortAt === cursorTime && row.id < cursorId);
                  })
                  .sort((a, b) => (b.reviewed_at || b.created_at).localeCompare(a.reviewed_at || a.created_at) || b.id.localeCompare(a.id))
                  .slice(0, limit)
                  .map(({ id, status: rowStatus, created_at, reviewed_at, content_type, size_bytes }) => ({ id, status: rowStatus, created_at, reviewed_at, content_type, size_bytes, sort_at: reviewed_at || created_at }));
                return { results };
              }
              if (/FROM application_submissions/i.test(sql)) return { results: [...rows.values()] };
              return { results: [] };
            },
            async run() {
              if (/INSERT INTO site_content/i.test(sql)) {
                const [id, content, updated_at] = values;
                if (/ON CONFLICT\s*\(id\)\s*DO NOTHING/i.test(sql) && siteContent.has(id)) return { meta: { changes: 0 } };
                siteContent.set(id, { id, content, updated_at });
                return { meta: { changes: 1 } };
              }
              if (/INSERT INTO admin_sessions/i.test(sql)) {
                const [tokenHash, passwordVersion, createdAt, expiresAt] = values;
                adminSessions.set(tokenHash, { token_hash: tokenHash, password_version: passwordVersion, created_at: createdAt, expires_at: expiresAt });
                return { meta: { changes: 1 } };
              }
              if (/DELETE FROM admin_sessions WHERE token_hash\s*=\s*\?/i.test(sql)) {
                const changed = adminSessions.delete(values[0]);
                return { meta: { changes: changed ? 1 : 0 } };
              }
              if (/DELETE FROM admin_sessions WHERE expires_at\s*<=\s*\?/i.test(sql)) {
                let changes = 0;
                for (const [hash, row] of adminSessions) if (row.expires_at <= values[0]) { adminSessions.delete(hash); changes += 1; }
                return { meta: { changes } };
              }
              if (/DELETE FROM admin_login_attempts WHERE window_started_at\s*<=\s*\?/i.test(sql)) {
                let changes = 0;
                for (const [hash, row] of adminLoginAttempts) if (row.window_started_at <= values[0]) { adminLoginAttempts.delete(hash); changes += 1; }
                return { meta: { changes } };
              }
              if (/DELETE FROM admin_login_attempts WHERE ip_hash\s*=\s*\?/i.test(sql)) {
                const changed = adminLoginAttempts.delete(values[0]);
                return { meta: { changes: changed ? 1 : 0 } };
              }
              if (/INSERT INTO application_submissions/i.test(sql)) {
                if (failures.insert) throw new Error("injected D1 insert failure");
                const [id, token_hash, object_key, content_type, size_bytes, source_ip_hash, image_hash, created_at] = values;
                rows.set(id, { id, token_hash, object_key, content_type, size_bytes, source_ip_hash, image_hash, status: "pending", created_at, reviewed_at: null });
                return { meta: { changes: 1 } };
              }
              if (/DELETE FROM application_submissions/i.test(sql)) {
                const [pendingCutoff, reviewedCutoff] = values;
                let changes = 0;
                for (const [id, row] of rows) {
                  const expiredPending = row.status === "pending" && row.created_at < pendingCutoff;
                  const expiredReviewed = ["approved", "rejected"].includes(row.status) && row.reviewed_at && row.reviewed_at < reviewedCutoff;
                  if (expiredPending || expiredReviewed) { rows.delete(id); changes += 1; }
                }
                return { meta: { changes } };
              }
              if (/UPDATE application_submissions SET status = \?/i.test(sql)) {
                if (failures.update) throw new Error("injected D1 update failure");
                const [status, object_key, reviewed_at, id, cutoff] = values;
                const row = rows.get(id);
                if (!row || row.status !== "pending" || row.created_at <= cutoff) return { meta: { changes: 0 } };
                Object.assign(row, { status, object_key, reviewed_at });
                if (failures.updateAfterCommit) throw new Error("injected response failure after D1 commit");
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            }
          };
        }
      };
    }
  };
  const bucket = {
    objects,
    async put(key, value, options = {}) {
      if (failures.put) throw new Error("injected R2 put failure");
      const bytes = value instanceof Uint8Array ? value.slice() : new Uint8Array(await new Response(value).arrayBuffer());
      objects.set(key, { bytes, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {} });
      return { key, size: bytes.byteLength };
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return { key, size: object.bytes.byteLength, httpMetadata: object.httpMetadata, body: new Response(object.bytes).body };
    },
    async delete(key) {
      if (failures.delete) throw new Error("injected R2 delete failure");
      objects.delete(key);
    },
    async list({ prefix = "", cursor = null, limit = 1000 } = {}) {
      const keys = [...objects.keys()].filter(key => key.startsWith(prefix)).sort();
      const start = cursor ? Math.max(0, keys.findIndex(key => key > cursor)) : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return { objects: page.map(key => ({ key })), truncated, cursor: truncated ? page.at(-1) : undefined };
    }
  };
  return { CONTENT_DB: db, APPLICATIONS_BUCKET: bucket, rows, siteContent, objects, adminSessions, adminLoginAttempts, failures };
}

export function createSubmissionForm({
  bytes = [0xff, 0xd8, 0xff, 0xdb, 0x00, 0x00, 0xff, 0xd9],
  contentType = "image/jpeg",
  consent = "on",
  turnstile = "valid-turnstile-response",
  filename = "private-original-name.jpg"
} = {}) {
  const form = new FormData();
  form.set("privacyConsent", consent);
  form.set("cf-turnstile-response", turnstile);
  form.set("statusImage", new Blob([Uint8Array.from(bytes)], { type: contentType }), filename);
  return form;
}

export async function withTurnstileResult(result, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") throw new Error("unexpected fetch destination");
    const body = new URLSearchParams(init.body);
    if (!body.get("secret") || !body.get("response")) throw new Error("missing Siteverify fields");
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try { return await callback(); }
  finally { globalThis.fetch = originalFetch; }
}
