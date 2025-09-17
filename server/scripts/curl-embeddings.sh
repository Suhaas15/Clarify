#!/usr/bin/env bash
set -euo pipefail

curl -s https://openrouter.ai/api/v1/embeddings \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "HTTP-Referer: http://localhost:8787" \
  -H "X-Title: pdf-reader-dev" \
  -d '{"model":"openai/text-embedding-3-small","input":["hello","world"]}' | jq .

