import express from 'express';
import bodyParser from 'body-parser';
import { CONFIG } from './config';
import { embedTexts } from './embeddings';
import { chat } from './chat';
import { db } from './db';
import { openai } from './openaiClient';

const app = express();
app.use(bodyParser.json());

app.get('/health', async (_req, res) => {
  try {
    // OpenAI health: tiny embed
    await embedTexts(['ping']);
    // OpenRouter health: tiny chat
    const reply = await chat([{ role: 'user', content: 'ping' }]);
    res.status(200).json({ ok: true, providers: { openai: true, openrouter: true }, reply });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.post('/embed', async (req, res) => {
  try {
    const { docId, title, chunks } = req.body || {};
    if (!docId || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ ok: false, error: 'docId and non-empty chunks[] are required' });
    }
    const texts = chunks.map((c: any) => c.text).filter(Boolean);
    const vectors = await embedTexts(texts); // number[][]

    const stmt = db.prepare(`
      INSERT INTO embeddings (doc_id, chunk_index, text, page, vector)
      VALUES (@doc_id, @chunk_index, @text, @page, @vector)
      ON CONFLICT(doc_id, chunk_index) DO UPDATE SET
        text=excluded.text,
        page=excluded.page,
        vector=excluded.vector
    `);

    const toBlob = (arr: number[]) => Buffer.from(Float32Array.from(arr).buffer);

    const tx = db.transaction((rows: any[]) => {
      rows.forEach(r => stmt.run(r));
    });

    const rows = vectors.map((vec, i) => ({
      doc_id: docId,
      chunk_index: i,
      text: chunks[i].text,
      page: chunks[i].page ?? null,
      vector: toBlob(vec),
    }));

    tx(rows);

    res.json({ ok: true, n: rows.length, docId, title });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('`messages` must be a non-empty array');
    }
    const content = await chat(messages);
    res.status(200).json({ content });
  } catch (err: any) {
    let detail: string | undefined;
    const rawDetail = err?.response?.data ?? err?.data ?? err?.response?.body;
    if (rawDetail) {
      if (typeof rawDetail === 'string') {
        detail = rawDetail;
      } else {
        try {
          detail = JSON.stringify(rawDetail);
        } catch {
          detail = String(rawDetail);
        }
      }
    }
    res.status(400).json({ error: err?.message || String(err), ...(detail ? { detail } : {}) });
  }
});

function fromBlobToFloat32(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i], y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1e-12);
}

app.post('/search', async (req, res) => {
  try {
    const { docId, query, k = 5 } = req.body || {};
    if (!docId || !query) {
      return res.status(400).json({ ok: false, error: 'docId and query are required' });
    }

    // 1) embed the query
    const q = await openai.embeddings.create({
      model: CONFIG.MODEL_EMBED,
      input: [query],
    });
    const qVec = Float32Array.from(q.data[0].embedding as number[]);

    // 2) load all vectors for docId
    const rows = db.prepare(
      `SELECT chunk_index, text, page, vector FROM embeddings WHERE doc_id = ?`
    ).all(docId) as { chunk_index: number, text: string, page: number | null, vector: Buffer }[];

    // 3) score and sort
    const scored = rows.map(r => ({
      chunk_index: r.chunk_index,
      text: r.text,
      page: r.page ?? null,
      score: cosineSim(qVec, fromBlobToFloat32(r.vector)),
    })).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(50, k)));

    res.json({ ok: true, docId, k: scored.length, results: scored });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.listen(CONFIG.PORT, () => {
  console.log(`server listening on :${CONFIG.PORT}`);
});
