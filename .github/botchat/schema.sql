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
