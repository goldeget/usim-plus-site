export function createMemoryCloudflare({ failInsert = false, failPut = false, failDelete = false, failUpdate = false, failUpdateAfterCommit = false, failRead = false } = {}) {
  const rows = new Map();
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
              return null;
            },
            async all() {
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
              if (/FROM application_submissions/i.test(sql)) return { results: [...rows.values()] };
              return { results: [] };
            },
            async run() {
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
                const [id, token_hash, object_key, content_type, size_bytes, created_at] = values;
                rows.set(id, { id, token_hash, object_key, content_type, size_bytes, status: "pending", created_at, reviewed_at: null });
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
    }
  };
  return { CONTENT_DB: db, APPLICATIONS_BUCKET: bucket, rows, objects, adminSessions, adminLoginAttempts, failures };
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
