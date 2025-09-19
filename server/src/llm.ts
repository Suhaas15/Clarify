import { chatWithMessages } from "./chat";

export async function answerWithContext(q: string, context: string) {
  const messages = [
    {
      role: "system" as const,
      content: "Answer only from context. If missing, say so. Keep citations like [[doc:...]].",
    },
    { role: "user" as const, content: `Q:\n${q}\n\nContext:\n${context}` },
  ];
  console.log("[ask] ctxTokens~:", Math.ceil(context.length / 4));
  const { reply } = await chatWithMessages(messages, undefined, true);
  return reply;
}
