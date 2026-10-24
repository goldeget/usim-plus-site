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

export default {
  async scheduled(_controller, env) {
    await Promise.all([purgeExpiredApplicationMetadata(env), purgeExpiredAdminAuth(env)]);
  }
};
