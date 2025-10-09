import { openrouter } from "./openrouterClient";
import { CONFIG } from "./config";

function normalizeAssistantContent(
  content: string | Array<{ type?: string; text?: string; [k: string]: any }> | any
): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((p) => p && (p.type === "text" || typeof p.text === "string"))
      .map((p) => (p.text ?? "").trim())
      .join("")
      .trim();
  }
  return "";
}

export async function answerWithContext(q: string, context: string) {
  const question = (q ?? "").toString().trim();
  const ctx = (context ?? "").toString().trim();

  if (!question) return "";

  const sys = "Answer only from context. If missing, say so. Keep citations like [[doc:...]].";
  const user = `Context:\n${ctx}\n\nQuestion:\n${question}`;

  const resp = await openrouter.chat.completions.create({
    model: CONFIG.CHAT_MODEL,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    max_tokens: CONFIG.CHAT_MAX_TOKENS,
  });

  const answer = normalizeAssistantContent(resp?.choices?.[0]?.message?.content);
  return answer || "";
}
