ALTER TABLE trackers
  ADD COLUMN poll_interval_minutes integer NOT NULL DEFAULT 60
  CHECK (poll_interval_minutes BETWEEN 15 AND 10080);
