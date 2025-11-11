// src/routes/admin/bot.ai.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";

const router = Router();

/** PATCH /api/admin/bots/:id/config */
router.patch(
  "/bots/:id/config",
  async (
    req: Request<
      { id: string },
      any,
      {
        openaiModel?: string;
        systemPrompt?: string;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
      }
    >,
    res: Response
  ) => {
    const { id } = req.params;
    const bot = await prisma.bot.findUnique({ where: { id } });
    if (!bot) return res.status(404).json({ ok: false, message: "bot_not_found" });

    const { openaiModel, systemPrompt, temperature, topP, maxTokens } = req.body;

    const config = await prisma.botConfig.upsert({
      where: { botId: id },
      create: {
        botId: id,
        openaiModel: openaiModel ?? "gpt-4o-mini",
        systemPrompt: systemPrompt ?? "",
        temperature: temperature ?? 0.3,
        topP: topP ?? 1,
        maxTokens: maxTokens ?? 800,
      },
      update: { openaiModel, systemPrompt, temperature, topP, maxTokens },
    });

    return res.json({ ok: true, config });
  }
);

export default router;
