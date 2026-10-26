import { refreshPublishedReviews } from "./functions/_lib/review-refresh.js";

export default {
  async scheduled(_controller, env) {
    if (!env?.CONTENT_DB || !env?.APPLICATIONS_BUCKET) return;
    const result = await refreshPublishedReviews({
      db: env.CONTENT_DB,
      bucket: env.APPLICATIONS_BUCKET
    });
    console.log(JSON.stringify({
      event: "review_daily_refresh",
      kstDate: result.kstDate,
      updated: result.updated,
      skipped: result.skipped
    }));
  }
};
