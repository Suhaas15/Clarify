import Database from 'better-sqlite3';
import { CONFIG } from './config';
import fs from 'fs';
import path from 'path';

// Ensure data folder exists if DB_PATH is a relative folder like ./data/xxx.db
const dir = path.dirname(CONFIG.PORT ? process.env.DB_PATH || './data/db.sqlite' : './data/db.sqlite');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(process.env.DB_PATH || './data/db.sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS embeddings (
    doc_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    page INTEGER,
    vector BLOB NOT NULL,
    PRIMARY KEY (doc_id, chunk_index)
  );
`);
