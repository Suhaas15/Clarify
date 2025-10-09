import { Hono } from 'hono';
import { float32ArrayToBytes } from './lib/vec';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

function json(c: any, status: number, data: unknown) {
  const origin = c.req.header('Origin') ?? '*';
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
  });
}

type Bindings = {
  CLARIFY_DB: D1Database;
  OPENAI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_BASE_URL: string;
  MODEL_EMBED: string;
  EMBEDDING_BATCH_SIZE: string;
  CHAT_MODEL: string;
  CHAT_MAX_TOKENS: string;
  HTTP_REFERER: string;
  X_TITLE: string;
  CORS_ALLOW_ORIGINS: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.options('*', (c) => {
  const origin = c.req.header('Origin') ?? '*';
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
  });
});

app.get('/health', (c) => {
  const hasOR = Boolean(c.env?.OPENROUTER_API_KEY);
  const hasModel = Boolean(c.env?.CHAT_MODEL);
  return json(c, 200, {
    ok: true,
    ts: Date.now(),
    openrouter: hasOR,
    model: hasModel ? c.env.CHAT_MODEL : null,
  });
});

app.post('/embed', async (c) => {
  const body = await c.req.json().catch(() => null) as {
    docId?: string;
    title?: string;
    chunks?: Array<{ text?: string; page?: number | null }>;
  } | null;

  if (!c.env.OPENAI_API_KEY) {
    return json(c, 500, { error: 'OPENAI_API_KEY is not configured' });
  }

  if (!body || typeof body.docId !== 'string' || !Array.isArray(body.chunks) || body.chunks.length === 0) {
    return json(c, 400, { error: 'docId and non-empty chunks[] are required' });
  }

  const docId = body.docId;
  const title = typeof body.title === 'string' ? body.title : null;
  const chunks = body.chunks
    .map((item) => ({
      text: typeof item?.text === 'string' ? item.text : '',
      page: Number.isFinite(item?.page) ? Number(item?.page) : null,
    }))
    .filter((item) => item.text.trim().length > 0);

  if (chunks.length === 0) {
    return json(c, 400, { error: 'chunks[] must include text values' });
  }

  const batchSize = Math.max(1, Number.parseInt(c.env.EMBEDDING_BATCH_SIZE || '64', 10) || 64);
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((chunk) => chunk.text);
    const embedResp = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: c.env.MODEL_EMBED,
        input: batch,
      }),
    });

    const embedData = await embedResp.json().catch(() => null);
    if (!embedResp.ok || !embedData?.data) {
      const reason = embedData?.error?.message || embedResp.statusText || 'Unknown error';
      return json(c, embedResp.status || 500, { error: `Embedding request failed: ${reason}` });
    }

    for (const record of embedData.data as Array<{ embedding: number[] }>) {
      embeddings.push(record.embedding);
    }
  }

  if (embeddings.length !== chunks.length) {
    return json(c, 500, { error: 'Embedding count mismatch' });
  }

  const now = Date.now();
  await c.env.CLARIFY_DB.prepare(
    'INSERT OR REPLACE INTO docs (id, title, created_at) VALUES (?, ?, ?)'
  ).bind(docId, title, now).run();

  await c.env.CLARIFY_DB.prepare('DELETE FROM chunks WHERE doc_id = ?').bind(docId).run();

  const statements = chunks.map((chunk, index) => {
    const vectorBytes = float32ArrayToBytes(embeddings[index]);
    return c.env.CLARIFY_DB
      .prepare('INSERT INTO chunks (doc_id, page, text, embedding) VALUES (?, ?, ?, ?)')
      .bind(docId, chunk.page, chunk.text, vectorBytes);
  });

  await c.env.CLARIFY_DB.batch(statements);

  return json(c, 200, { ok: true });
});

app.post('/chat', async (c) => {
  try {
    if (!c.env.OPENROUTER_API_KEY) {
      return json(c, 500, { error: 'OPENROUTER_API_KEY is not configured' });
    }

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json(c, 400, { error: 'Invalid JSON body' });
    }

    const { question, context, fromContext, max } = body as {
      question?: unknown;
      context?: unknown;
      fromContext?: unknown;
      max?: unknown;
    };

    if (typeof question !== 'string' || question.trim().length === 0) {
      return json(c, 400, { error: "Missing or empty 'question' (string)" });
    }

    const ctx = typeof context === 'string' ? context : '';
    const onlyContext = Boolean(fromContext);
    const maxOut = typeof max === 'number' && max > 0 ? Math.min(max, 4096) : 512;

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (onlyContext && ctx.trim()) {
      messages.push({
        role: 'system',
        content:
          "You are Clarify. Answer ONLY using the provided context. If the context does not contain the answer, reply with: 'I don't have enough information in the provided context.' Do not include any hidden reasoning.",
      });
      messages.push({ role: 'user', content: `Context:\n${ctx}\n\nQuestion:\n${question.trim()}` });
    } else if (ctx.trim()) {
      messages.push({
        role: 'system',
        content:
          'You are Clarify. Prefer the provided context; if insufficient, you may use general knowledge. Do not include hidden reasoning.',
      });
      messages.push({ role: 'user', content: `Context:\n${ctx}\n\nQuestion:\n${question.trim()}` });
    } else {
      messages.push({
        role: 'system',
        content: 'You are Clarify. Answer clearly and concisely. Do not include hidden reasoning.',
      });
      messages.push({ role: 'user', content: question.trim() });
    }

    const model = c.env?.CHAT_MODEL || 'openai/gpt-4o-mini';
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-title': c.env?.X_TITLE || 'clarify',
        'http-referer': c.env?.HTTP_REFERER || 'https://clarify-ai.workers.dev',
        authorization: `Bearer ${c.env?.OPENROUTER_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_output_tokens: maxOut,
      }),
    });

    const text = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {}

    if (!resp.ok) {
      console.error('OpenRouter error', resp.status, text.slice(0, 500));
      return json(c, 502, { error: `Provider ${resp.status}`, preview: text.slice(0, 400) });
    }

    let content = '';
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      const msg = data.choices[0].message;
      if (typeof msg.content === 'string' && msg.content.trim()) {
        content = msg.content.trim();
      }
    }

    if (!content) {
      console.warn('No assistant text in provider response. Shape preview:', text.slice(0, 500));
      content = 'No reply.';
    }

    return json(c, 200, {
      content,
      model,
      usage: data?.usage ?? undefined,
    });
  } catch (err: any) {
    console.error('Chat fatal error:', err?.stack || err);
    return json(c, 500, { error: 'Internal error', detail: String(err?.message || err) });
  }
});

export default app;
