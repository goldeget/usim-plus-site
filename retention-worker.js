const METADATA_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
const ADMIN_LOGIN_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function purgeExpiredApplicationMetadata(env, now = Date.now()) {
  const cutoff = new Date(now - METADATA_RETENTION_MS).toISOString();
  return env.CONTENT_DB.prepare(
    "DELETE FROM application_submissions WHERE (status = 'pending' AND created_at < ?) OR (status IN ('approved', 'rejected') AND reviewed_at < ?)"
  ).bind(cutoff, cutoff).run();
}

export async function purgeExpiredAdminAuth(env, now = Date.now()) {
  const nowIso = new Date(now).toISOString();
  const attemptsCutoff = new Date(now - ADMIN_LOGIN_ATTEMPT_RETENTION_MS).toISOString();
  const [sessions, attempts] = await Promise.all([
    env.CONTENT_DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(nowIso).run(),
    env.CONTENT_DB.prepare("DELETE FROM admin_login_attempts WHERE window_started_at <= ?").bind(attemptsCutoff).run()
  ]);
  return { sessions: sessions?.meta?.changes || 0, attempts: attempts?.meta?.changes || 0 };
}

export async function purgeOrphanedReviewedImages(env) {
  if (!env.CONTENT_DB || !env.APPLICATIONS_BUCKET?.list) return { checked: 0, deleted: 0, failed: 0 };
  let checked = 0;
  let deleted = 0;
  let failed = 0;
  let cursor;
  do {
    const page = await env.APPLICATIONS_BUCKET.list({ prefix: "reviewed/", cursor, limit: 500 });
    for (const object of page.objects || []) {
      const match = /^reviewed\/([A-Za-z0-9_-]{22})\/(?:approved|rejected)\.(?:jpg|png)$/.exec(object.key || "");
      if (!match) continue;
      checked += 1;
      const id = `UP-${match[1]}`;
      try {
        const row = await env.CONTENT_DB.prepare("SELECT id, object_key FROM application_submissions WHERE id = ?").bind(id).first();
        if (row?.object_key === object.key) continue;
        await env.APPLICATIONS_BUCKET.delete(object.key);
        deleted += 1;
      } catch { failed += 1; }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { checked, deleted, failed };
}

export default {
  async scheduled(_controller, env) {
    await purgeExpiredApplicationMetadata(env);
    await purgeExpiredAdminAuth(env);
    await purgeOrphanedReviewedImages(env);
  }
};
