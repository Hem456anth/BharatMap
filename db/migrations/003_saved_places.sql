-- 003: saved places sync (Home / Work / Favourites / custom lists) for signed-in users.
-- One JSON document per user, validated and size-capped by the API (server/app.js, PUT /api/me/places).
CREATE TABLE IF NOT EXISTS user_places (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  updated_ms  INTEGER NOT NULL
);
