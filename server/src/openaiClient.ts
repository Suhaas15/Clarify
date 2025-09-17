import OpenAI from 'openai';
import { CONFIG } from './config';

export const openai = new OpenAI({
  apiKey: CONFIG.OPENAI_API_KEY,
});

export const openrouter = new OpenAI({
  apiKey: CONFIG.OPENROUTER_API_KEY,
  baseURL: CONFIG.OPENROUTER_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': CONFIG.HTTP_REFERER,
    'X-Title': CONFIG.X_TITLE,
  },
});
