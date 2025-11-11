// src/lib/ai.ts
import OpenAI from "openai";

/** พารามิเตอร์สำหรับถาม AI (อนุญาตส่ง apiKey ต่อบอทได้) */
export type AskParams = {
  apiKey?: string;                 // ← ใช้คีย์จาก secrets ของบอท ถ้ามี
  model: string;                   // เช่น "gpt-4o-mini"
  systemPrompt: string;            // คำสั่งบทบาทระบบ (persona/กติกา)
  temperature: number;             // 0.0 - 1.0
  maxTokens: number;               // ขีดจำกัดคำตอบ
  userText: string;                // ข้อความผู้ใช้
  knowledgeSnippets?: string[];    // บริบทจากคลังความรู้ (option)
};

/** สร้าง OpenAI client จากคีย์ที่ระบุ หรือ fallback ไป ENV */
function buildClient(apiKey?: string) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("missing_openai_api_key");
  return new OpenAI({ apiKey: key });
}

/** เรียก Chat Completions พร้อมแนบบริบทความรู้ (ถ้ามี) */
export async function askAI(p: AskParams): Promise<string> {
  const client = buildClient(p.apiKey);

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: p.systemPrompt },
  ];

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

  return resp.choices?.[0]?.message?.content?.trim() || "";
}

/** ทำ Embedding ข้อความหลายรายการ (ใช้สร้าง/ค้นคลังความรู้) */
export async function embedTexts(
  texts: string[],
  apiKey?: string,
  model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small"
): Promise<number[][]> {
  const client = buildClient(apiKey);
  const resp = await client.embeddings.create({ model, input: texts });
  // @ts-ignore: SDK คืน embedding เป็น number[]
  return resp.data.map((d) => d.embedding as number[]);
}
