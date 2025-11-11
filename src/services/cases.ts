import { prisma } from "../lib/prisma";  // หรือ "../db/prisma"
import { z } from "zod";

const CaseMetaSchema = z.object({
  userId: z.string().optional(),
  phone: z.string().optional(),
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  time: z.string().optional(),
  slipUrl: z.string().url().optional(),
}).strict();

export async function logCase(botId: string, kind: string, text: string, meta: any = null) {
  const parsed = meta ? CaseMetaSchema.safeParse(meta) : { success: true, data: null };
  const safeMeta = parsed.success ? parsed.data : null;
  return prisma.caseItem.create({ data: { botId, kind, text, meta: safeMeta as any } });
}
