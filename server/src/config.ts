import * as dotenv from 'dotenv';
dotenv.config();

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const CONFIG = {
  PORT: Number(process.env.PORT || 8787),
  DB_PATH: process.env.DB_PATH || './data/db.sqlite',

  // OpenAI (embeddings)
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  MODEL_EMBED: process.env.MODEL_EMBED || 'text-embedding-3-small',
  EMBEDDING_BATCH_SIZE: Number(process.env.EMBEDDING_BATCH_SIZE || 64),

  // OpenRouter (chat)
  OPENROUTER_API_KEY: required('OPENROUTER_API_KEY'),
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  CHAT_MODEL: process.env.CHAT_MODEL || 'openai/gpt-4o-mini',
  CHAT_MAX_TOKENS: Number(process.env.CHAT_MAX_TOKENS || 4096),
  HTTP_REFERER: process.env.HTTP_REFERER || 'http://localhost:8787',
  X_TITLE: process.env.X_TITLE || 'pdf-reader-dev',
} as const;
