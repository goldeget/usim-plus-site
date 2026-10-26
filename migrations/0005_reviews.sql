CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  published_at TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  snippet TEXT NOT NULL,
  snippet_sha256 TEXT NOT NULL,
  body_sha256 TEXT NOT NULL,
  body_norm_sha256 TEXT NOT NULL,
  body_r2_key TEXT NOT NULL,
  body_byte_length INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  source_row_id TEXT,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'hidden')),
  featured INTEGER NOT NULL DEFAULT 0,
  sort_boost INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_body_sha ON reviews(body_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_body_norm_sha ON reviews(body_norm_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_snippet_sha ON reviews(snippet_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_source_row
  ON reviews(source, source_row_id)
  WHERE source_row_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_list ON reviews(status, published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(status, rating, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_featured ON reviews(status, featured DESC, sort_boost DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS review_stats (
  id TEXT PRIMARY KEY CHECK (id = 'global'),
  total_published INTEGER NOT NULL,
  avg_rating REAL NOT NULL,
  histogram_json TEXT NOT NULL,
  rating_sum INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_import_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  rows_total INTEGER,
  rows_ok INTEGER,
  rows_dup INTEGER,
  rows_invalid INTEGER,
  target_cap INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
