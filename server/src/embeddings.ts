import { OpenAI } from 'openai';
import { CONFIG } from './config';

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!CONFIG.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing');
  }
  const res = await openai.embeddings.create({
    model: CONFIG.MODEL_EMBED,
    input: texts,
  });
  // Map data[].embedding to number[][]
  return res.data.map(d => d.embedding as number[]);
}
