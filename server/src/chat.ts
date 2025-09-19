import type { Request, Response } from 'express';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { openrouter } from './openrouterClient';
import { CONFIG } from './config';

const STRICT_PROMPT =
  "You are a careful assistant. Answer ONLY using the provided CONTEXT. If the answer is not in the context, reply: \"I don't know from the provided context.\"";
const DEFAULT_PROMPT =
  'You are a helpful assistant. Prefer the provided CONTEXT, but you may use general knowledge if needed. Cite clearly when the context is insufficient.';

export async function chatWithMessages(
  messages: ChatCompletionMessageParam[],
  maxTokens?: number,
  fromContext = false
) {
  const max = Math.min(
    Number(maxTokens ?? CONFIG.CHAT_MAX_TOKENS) || CONFIG.CHAT_MAX_TOKENS,
    CONFIG.CHAT_MAX_TOKENS
  );

  console.log(
    `[chat] provider=OpenRouter base=${CONFIG.OPENROUTER_BASE_URL} model=${CONFIG.CHAT_MODEL} max=${max} fromContext=${fromContext}`
  );

  const completion = await openrouter.chat.completions.create({
    model: CONFIG.CHAT_MODEL,
    messages,
    max_tokens: max,
  });

  const reply = completion.choices?.[0]?.message?.content?.trim?.() ?? '';
  return { reply: reply || '(no model reply)', usage: completion.usage };
}

export async function answerWithContext(context: string, question: string, strict: boolean) {
  const sys = strict ? STRICT_PROMPT : DEFAULT_PROMPT;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: sys },
    { role: 'user', content: `CONTEXT:\n${context}\n\nQUESTION: ${question}` },
  ];

  return chatWithMessages(messages, CONFIG.CHAT_MAX_TOKENS, true);
}

export async function chat(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as {
      messages?: ChatCompletionMessageParam[];
      max_tokens?: number;
      fromContext?: boolean;
      context?: string;
      question?: string;
      strict?: boolean;
    };

    const context = body.context?.toString?.();
    const question = body.question?.toString?.();
    const strict = Boolean(body.strict);

    if (context && question) {
      const result = await answerWithContext(context, question, strict);
      console.log(
        '[chat] reply(sample):',
        (result.reply ?? '').slice(0, 120).replace(/\s+/g, ' '),
        '...'
      );
      return res.json({ ok: true, reply: result.reply, usage: result.usage });
    }

    const messages = Array.isArray(body.messages) ? body.messages : undefined;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ ok: false, error: 'Missing field: context/question or messages' });
    }

    const result = await chatWithMessages(messages, body.max_tokens, Boolean(body.fromContext));
    console.log(
      '[chat] reply(sample):',
      (result.reply ?? '').slice(0, 120).replace(/\s+/g, ' '),
      '...'
    );
    return res.json({ ok: true, reply: result.reply, usage: result.usage });
  } catch (err: any) {
    const msg = err?.response?.data?.error?.message || err?.message || 'unknown error';
    console.error('[chat] ERROR:', msg, err?.response?.data || '');
    return res.status(400).json({ ok: false, error: msg });
  }
}
