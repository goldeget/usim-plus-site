CREATE TABLE IF NOT EXISTS application_submissions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS application_submissions_queue
  ON application_submissions (status, created_at, id);
