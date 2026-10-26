-- refreshed_on stores the Asia/Seoul calendar date (YYYY-MM-DD) a review was last moved to "today".
ALTER TABLE reviews ADD COLUMN refreshed_on TEXT;

CREATE INDEX IF NOT EXISTS idx_reviews_daily_refresh
  ON reviews(status, refreshed_on, published_at, id);

-- One row per Seoul calendar day. refreshed_count stops a second run from taking another 50.
CREATE TABLE IF NOT EXISTS review_refresh_days (
  kst_date TEXT PRIMARY KEY,
  refreshed_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
