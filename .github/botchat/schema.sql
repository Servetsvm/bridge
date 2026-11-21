-- the robots' chats: what the player wrote, what the robot answered, the player's 👍/👎 (no names of players, no cards)
CREATE TABLE IF NOT EXISTS chat (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  lang TEXT,
  bot TEXT,
  role TEXT,
  phase TEXT,
  text TEXT,
  reply TEXT,
  src TEXT,
  rate INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
CREATE INDEX IF NOT EXISTS chat_ts ON chat (ts);
CREATE INDEX IF NOT EXISTS chat_rate ON chat (rate, ts);

-- the pages' errors (what went wrong, where, which version and browser; no names), one row per kind with its count
CREATE TABLE IF NOT EXISTS errs (
  k TEXT PRIMARY KEY,
  first INTEGER NOT NULL,
  last INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 1,
  ver TEXT,
  msg TEXT,
  src TEXT,
  stack TEXT,
  ua TEXT,
  lang TEXT,
  page TEXT
);
CREATE INDEX IF NOT EXISTS errs_last ON errs (last);
