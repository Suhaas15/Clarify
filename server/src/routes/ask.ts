import { Request, Response } from 'express';
import { db } from '../db';
import { embedTexts } from '../embeddings';
import { answerWithContext } from '../llm';

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

export async function askRoute(req: Request, res: Response) {
  try {
    const { q } = req.body as { q: string };
    if (!q) return res.status(400).json({ error: 'q is required' });

    const [qEmb] = await embedTexts([q]);
    const qVec = Float32Array.from((qEmb || []) as number[]);

    const rows = db.prepare(
      `SELECT doc_id, chunk_index, text, page, vector FROM embeddings`
    ).all() as { doc_id: string; chunk_index: number; text: string; page: number | null; vector: Buffer }[];

    const scored = rows
      .map((r) => ({
        docId: r.doc_id,
        chunk_index: r.chunk_index,
        text: r.text,
        page: r.page ?? null,
        score: cosineSim(qVec, fromBlobToFloat32(r.vector)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    const context =
      scored.length === 0
        ? ''
        : scored
            .map((r: any) => `[[doc:${r.docId}${r.page !== null && r.page >= 0 ? ` p.${r.page}` : ''}]] ${r.text}`)
            .join('\n\n');

    const answer = await answerWithContext(q, context);

    res.json({
      answer,
      citations: scored.map((r: any) => ({
        docId: r.docId,
        page: r.page !== null && r.page >= 0 ? r.page : undefined,
        title: r.docId,
        score: r.score
      }))
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'ask failed' });
  }
}
