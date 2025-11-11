import OpenAI from "openai";
import { prisma } from "../lib/prisma"; // ถ้าใช้ ../db/prisma ให้ปรับพาธ

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBED = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

/** ตัดเนื้อหาเป็นชิ้นเล็กๆ สำหรับทำดัชนี */
export function splitChunks(body: string, size = 800): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of (body || "").split(/\r?\n/)) {
    if ((cur + "\n" + line).length > size) {
      if (cur.trim()) out.push(cur.trim());
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export async function embedText(texts: string[]): Promise<number[][]> {
  const resp = await openai.embeddings.create({ model: EMBED, input: texts });
  // @ts-ignore
  return resp.data.map((d) => d.embedding as number[]);
}

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i] ?? 0; dot += x*y; na += x*x; nb += y*y; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

/** สร้างดัชนีให้เอกสาร (ถ้ายังไม่มีโมเดล KnowledgeChunk ให้ข้ามอย่างปลอดภัย) */
export async function buildIndexForDoc(docId: string) {
  const doc = await prisma.knowledgeDoc.findUnique({ where: { id: docId } });
  if (!doc) throw new Error("doc not found");
  const chunks = splitChunks(doc.body || "");
  if (!chunks.length) return 0;

  // ใช้ any เพื่อหลบ type และเช็กฟังก์ชันก่อนเรียก
  const table = (prisma as any).knowledgeChunk;
  if (!table || typeof table.create !== "function") return 0;

  const embs = await embedText(chunks);
  for (let i = 0; i < chunks.length; i++) {
    await table.create({
      data: {
        tenant: doc.tenant,
        docId: doc.id,
        content: chunks[i],
        embedding: embs[i] as any,
        tokens: chunks[i].length,
      },
    });
  }
  return chunks.length;
}

/** ค้นหาความรู้ที่เกี่ยวข้อง (ถ้าไม่มีตาราง ให้คืน [] เพื่อให้ระบบทำงานต่อได้) */
export async function searchRelevant(tenant: string, query: string, limit = 5) {
  const table = (prisma as any).knowledgeChunk;
  if (!table || typeof table.findMany !== "function") return [];

  const [qEmb] = await embedText([query]);
  const items = await table.findMany({
    where: { tenant },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const scored = (items as any[]).map((it) => ({
    id: it.id,
    content: it.content,
    score: cosine(qEmb, (it.embedding as number[]) || []),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
