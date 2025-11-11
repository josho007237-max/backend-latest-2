// src/lib/ai.ts
import OpenAI from "openai";

export type AskParams = {
  apiKey?: string;            // ← ใช้คีย์จากบอท ถ้ามี
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  userText: string;
  knowledgeSnippets?: string[];
};

export async function askAI(p: AskParams) {
  const apiKey = p.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("missing_openai_api_key");

  const client = new OpenAI({ apiKey });

  const messages: any[] = [{ role: "system", content: p.systemPrompt }];
  if (p.knowledgeSnippets?.length) {
    messages.push({
      role: "system",
      content: `บริบทอ้างอิง:\n${p.knowledgeSnippets.join("\n---\n")}`,
    });
  }
  messages.push({ role: "user", content: p.userText });

  const resp = await client.chat.completions.create({
    model: p.model,
    temperature: p.temperature,
    max_tokens: p.maxTokens,
    messages,
  });

  return resp.choices[0]?.message?.content?.trim() || "";
}

export async function embedTexts(texts: string[], apiKey?: string) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("missing_openai_api_key");
  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
  const resp = await client.embeddings.create({ model, input: texts });
  // @ts-ignore
  return resp.data.map((d) => d.embedding as number[]);
}
