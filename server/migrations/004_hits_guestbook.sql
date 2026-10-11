-- Hit counter and guestbook. Safe to run more than once.

CREATE TABLE IF NOT EXISTS hits (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO hits (id, count) VALUES (1, 2000);
-- Re-running this file must not add another 2000, and must not lower a counter
-- that has already moved past the seed.
UPDATE hits SET count = 2000 WHERE id = 1 AND count < 2000;

CREATE TABLE IF NOT EXISTS hit_visitors (
  visitor_hash TEXT NOT NULL,
  day          TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (visitor_hash, day)
);

CREATE TABLE IF NOT EXISTS guestbook (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  city       TEXT,
  message    TEXT NOT NULL,
  page       TEXT NOT NULL DEFAULT 'guestbook' CHECK (page IN ('guestbook', 'tyler')),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guestbook_public ON guestbook(page, status, created_at DESC);
