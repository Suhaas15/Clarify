CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT,
  page INTEGER,
  text TEXT,
  embedding BLOB,
  FOREIGN KEY(doc_id) REFERENCES docs(id)
);
