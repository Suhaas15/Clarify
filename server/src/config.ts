import * as dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '8787', 10),
  DB_PATH: process.env.DB_PATH || './data',

  // Embeddings (OpenAI)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  MODEL_EMBED: process.env.MODEL_EMBED || 'text-embedding-3-small',
  EMBEDDING_BATCH_SIZE: parseInt(process.env.EMBEDDING_BATCH_SIZE || '64', 10),

  // Chat (OpenRouter)
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  CHAT_MODEL: process.env.CHAT_MODEL || 'openai/gpt-5-nano',
  CHAT_MAX_TOKENS: parseInt(process.env.CHAT_MAX_TOKENS || '4096', 10),

  // Optional headers for OpenRouter rankings
  HTTP_REFERER: process.env.HTTP_REFERER || 'http://localhost:8787',
  X_TITLE: process.env.X_TITLE || 'pdf-reader-dev',
} as const;
