-- 004 (v0.5): community incident reports (pothole / waterlogging / closure / police check; expire after 2 h;
-- unverified, confidence from votes) and live location shares (time-limited, secret-protected updates).
CREATE TABLE IF NOT EXISTS incidents (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('pothole','waterlogging','closure','police')),
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_ms  INTEGER NOT NULL,
  expires_ms  INTEGER NOT NULL,
  up          INTEGER NOT NULL DEFAULT 0,
  down        INTEGER NOT NULL DEFAULT 0,
  reporter    TEXT NOT NULL            -- salted hash of the reporting client (no IP stored)
);
CREATE INDEX IF NOT EXISTS incidents_geo ON incidents(lat, lng);
CREATE INDEX IF NOT EXISTS incidents_exp ON incidents(expires_ms);
CREATE TABLE IF NOT EXISTS incident_votes (
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  voter       TEXT NOT NULL,
  vote        INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  PRIMARY KEY (incident_id, voter)
);
CREATE TABLE IF NOT EXISTS live_shares (
  id          TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  lat         REAL,
  lng         REAL,
  heading     REAL,
  updated_ms  INTEGER,
  created_ms  INTEGER NOT NULL,
  expires_ms  INTEGER NOT NULL
);
