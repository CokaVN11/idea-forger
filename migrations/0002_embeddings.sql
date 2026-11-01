-- Semantic links: one normalized float32 embedding per note (bge-m3, 1024 dims).
-- Kept out of `notes` so writes never bump updated_at or bloat SELECT *.
CREATE TABLE note_embeddings (
  note_id INTEGER PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  vec     BLOB NOT NULL
);
