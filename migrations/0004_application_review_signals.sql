ALTER TABLE application_submissions ADD COLUMN source_ip_hash TEXT;
ALTER TABLE application_submissions ADD COLUMN image_hash TEXT;

CREATE INDEX IF NOT EXISTS application_submissions_source_ip_hash
  ON application_submissions (source_ip_hash, created_at);
CREATE INDEX IF NOT EXISTS application_submissions_image_hash
  ON application_submissions (image_hash, created_at);
CREATE INDEX IF NOT EXISTS application_submissions_reviewed_at
  ON application_submissions (status, reviewed_at, created_at, id);
