const METADATA_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

export async function purgeExpiredApplicationMetadata(env, now = Date.now()) {
  const cutoff = new Date(now - METADATA_RETENTION_MS).toISOString();
  return env.CONTENT_DB.prepare(
    "DELETE FROM application_submissions WHERE (status = 'pending' AND created_at < ?) OR (status IN ('approved', 'rejected') AND reviewed_at < ?)"
  ).bind(cutoff, cutoff).run();
}

export default {
  async scheduled(_controller, env) {
    await purgeExpiredApplicationMetadata(env);
  }
};
