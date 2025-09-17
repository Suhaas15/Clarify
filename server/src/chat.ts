import { openrouter } from './openaiClient';
import { CONFIG } from './config';

export async function chat(messages: { role: 'user' | 'system' | 'assistant'; content: string }[]) {
  const resp = await openrouter.chat.completions.create({
    model: CONFIG.CHAT_MODEL,
    max_tokens: CONFIG.CHAT_MAX_TOKENS,
    messages,
  });
  return resp.choices?.[0]?.message?.content ?? '';
}
