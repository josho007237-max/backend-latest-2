// src/routes/ai/answer.ts
import { Router } from "express";
import { prisma } from "../../lib/prisma";          // ถ้าใช้ src/db/prisma.ts ให้เปลี่ยนเป็น "../../db/prisma"
import { askAI } from "../../lib/ai";
import { authGuard } from "../../mw/auth";
import { searchRelevant } from "../../services/knowledge";

type AskBody = {
  botId?: string;
  message?: string;
  limit?: number;        // จำนวนชิ้น knowledge (default 5)
};

const r = Router();

// ต้องมี JWT ก่อนถึงจะเรียกได้
r.use(authGuard);

r.post("/", async (req, res) => {
  try {
    const tenant = (req.headers["x-tenant"] as string) || "bn9";
    const { botId, message, limit } = (req.body || {}) as AskBody;

    if (!botId || !message) {
      return res
        .status(400)
        .json({ ok: false, code: "invalid_input", message: "botId/message required" });
    }

    // โหลดบอทพร้อม config + secrets
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { config: true, secrets: true },
    });

    if (!bot || !bot.config) {
      return res
        .status(404)
        .json({ ok: false, code: "not_found", message: "bot/config not found" });
    }

    // เลือกคีย์จาก secrets ก่อน ถ้าไม่มีจึงใช้ .env
    const apiKey =
      (bot.secrets as any)?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        code: "missing_openai_key",
        message:
          "OpenAI API key is not set on bot secrets nor in environment.",
      });
    }

    // หา knowledge ที่เกี่ยวข้อง (fallback เป็น [] ได้)
    const kLimit = typeof limit === "number" && limit > 0 ? limit : 5;
    const chunks = await searchRelevant(tenant, message, kLimit);

    // เรียก AI ด้วย config ของบอท
    const out = await askAI({
      apiKey,
      model:
        (bot.config as any)?.model ||
        process.env.OPENAI_MODEL ||
        "gpt-4o-mini",
      systemPrompt:
        (bot.config as any)?.systemPrompt || "คุณคือผู้ช่วยที่สุภาพและกระชับ",
      temperature: (bot.config as any)?.temperature ?? 0.4,
      maxTokens: (bot.config as any)?.maxTokens ?? 400,
      userText: message,
      knowledgeSnippets: chunks.map((c: any) => c.content),
    });

    return res.json({ ok: true, answer: out, context: chunks });
  } catch (e: any) {
    console.error("[AI/ANSWER ERROR]", e);
    const msg = e?.message || "internal_error";
    return res
      .status(msg === "missing_openai_api_key" ? 400 : 500)
      .json({
        ok: false,
        code:
          msg === "missing_openai_api_key"
            ? "missing_openai_key"
            : "internal_error",
        message: msg,
      });
  }
});

export default r;
