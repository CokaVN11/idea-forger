-- Idea Forge — Capture → Distill → Connect → Spark → Ship
-- Cloudflare D1 (SQLite)

-- NOTES: mỗi note = 1 ý (atomic, Zettelkasten)
CREATE TABLE notes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL DEFAULT 'idea',      -- quote | link | idea | lesson | book | video | observation
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',          -- nội dung thô khi capture (Input)
  summary       TEXT NOT NULL DEFAULT '',          -- tóm 1 câu kiểu Feynman (Learner)
  why_matters   TEXT NOT NULL DEFAULT '',          -- vì sao quan trọng với mình (Context)
  source_url    TEXT NOT NULL DEFAULT '',
  source_title  TEXT NOT NULL DEFAULT '',
  stage         TEXT NOT NULL DEFAULT 'inbox',     -- inbox | distilled | archived
  para          TEXT NOT NULL DEFAULT 'resource',  -- project | area | resource | archive (PARA)
  para_ref      TEXT NOT NULL DEFAULT '',          -- tên project/area cụ thể
  next_action   TEXT NOT NULL DEFAULT '',          -- hành động tiếp theo (Activator)
  learned_at    TEXT NOT NULL DEFAULT (date('now')), -- mốc timeline (Context)
  -- Spaced repetition (SM-2 rút gọn)
  review_due    TEXT,                              -- NULL = chưa vào vòng ôn
  review_interval INTEGER NOT NULL DEFAULT 0,      -- ngày
  review_ease   REAL NOT NULL DEFAULT 2.5,
  review_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  distilled_at  TEXT
  -- V2: embedding_id TEXT (Vectorize)
);
CREATE INDEX idx_notes_stage   ON notes(stage);
CREATE INDEX idx_notes_learned ON notes(learned_at);
CREATE INDEX idx_notes_review  ON notes(review_due);

-- TAGS
CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);
CREATE TABLE note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- LINKS: liên kết 2 chiều giữa các note, kèm lý do (Connect / Context)
CREATE TABLE links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id    INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (from_id, to_id)
);
CREATE INDEX idx_links_to ON links(to_id);

-- OUTPUTS: thứ mình ship ra (Express / Activator)
CREATE TABLE outputs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'prototype',   -- prototype | post | talk | doc | code | decision
  status     TEXT NOT NULL DEFAULT 'planned',     -- planned | doing | shipped
  url        TEXT NOT NULL DEFAULT '',
  notes_text TEXT NOT NULL DEFAULT '',
  deadline   TEXT,
  shipped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE output_notes (
  output_id INTEGER NOT NULL REFERENCES outputs(id) ON DELETE CASCADE,
  note_id   INTEGER NOT NULL REFERENCES notes(id)   ON DELETE CASCADE,
  PRIMARY KEY (output_id, note_id)
);

-- SPARKS: log các lần Idea Collider (Ideation)
CREATE TABLE sparks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  note_a      INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  note_b      INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  prompt      TEXT NOT NULL DEFAULT '',
  idea_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FULL-TEXT SEARCH
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, summary, why_matters, source_title,
  content='notes', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body, summary, why_matters, source_title)
  VALUES (new.id, new.title, new.body, new.summary, new.why_matters, new.source_title);
END;
CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body, summary, why_matters, source_title)
  VALUES ('delete', old.id, old.title, old.body, old.summary, old.why_matters, old.source_title);
END;
CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body, summary, why_matters, source_title)
  VALUES ('delete', old.id, old.title, old.body, old.summary, old.why_matters, old.source_title);
  INSERT INTO notes_fts(rowid, title, body, summary, why_matters, source_title)
  VALUES (new.id, new.title, new.body, new.summary, new.why_matters, new.source_title);
END;
