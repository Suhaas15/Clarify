import type { Request, Response } from "express";
import { CONFIG } from "./config";

export async function chat(req: Request, res: Response) {
  try {
    const { question: rawQuestion, context: rawContext, fromContext: rawFromContext, max: rawMax } = req.body ?? {};
    const question = typeof rawQuestion === 'string' ? rawQuestion : '';
    const context = typeof rawContext === 'string' ? rawContext : '';
    const fromContext = Boolean(rawFromContext);
    const maxTokens = Number.isFinite(rawMax) ? Math.max(64, Math.min(4096, Number(rawMax))) : 512;

    const trimmedQuestion = question.trim();
    const trimmedContext = context.trim();

    if (!trimmedQuestion && !trimmedContext) {
      return res.status(400).json({ error: 'Missing question or context' });
    }

    const SYSTEM_BASE = fromContext
      ? 'You answer ONLY using the provided CONTEXT. If the answer is not in CONTEXT, say "I couldn’t find that in the provided context." Return plain text only.'
      : 'Be helpful and concise. Prefer the user-provided CONTEXT when relevant. Return plain text only, no hidden reasoning.';

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: SYSTEM_BASE }
    ];

    if (trimmedContext) {
      messages.push({
        role: 'user',
        content: `CONTEXT:\n${trimmedContext}`
      });
    }

    messages.push({
      role: 'user',
      content: trimmedQuestion || 'Please respond.'
    });

    const baseUrl = (CONFIG.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': CONFIG.HTTP_REFERER || 'http://localhost:8787',
        'X-Title': CONFIG.X_TITLE || 'clarify-dev'
      },
      body: JSON.stringify({
        model: CONFIG.CHAT_MODEL,
        messages,
        max_output_tokens: maxTokens,
        temperature: 0.2
      })
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      const detail = data && data.error ? `: ${data.error}` : '';
      return res.status(resp.status || 502).json({ error: `Backend error ${resp.status || 502}${detail}` });
    }

    const content =
      data?.choices?.[0]?.message?.content?.toString?.().trim?.() ||
      '';

    if (!content) {
      console.error('No assistant text found. Provider response:', JSON.stringify(data, null, 2));
      return res.status(502).json({ error: 'No assistant text in provider response.' });
    }

    return res.json({ content });
  } catch (err: any) {
    console.error("[/chat] error:", err?.message || err);
    return res.status(500).json({ error: "Chat failed" });
  }
}
