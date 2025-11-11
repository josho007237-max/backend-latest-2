// src/routes/admin.bots.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma"; // correct path from src/routes -> src/lib
import { z } from "zod";

const router = Router();

// allow-list models as literal tuple
const ALLOWED_MODELS = ["gpt-4o-mini", "gpt-4o", "o4-mini", "gpt-3.5-turbo"] as const;
type AllowedModel = typeof ALLOWED_MODELS[number];

// default fields for a new BotConfig (do NOT include relation fields here)
const defaultBotConfigFields = {
  openaiModel: "gpt-4o-mini" as AllowedModel,
  systemPrompt: "",
  temperature: 0.3,
  topP: 1,
  maxTokens: 800,
};

const configUpdateSchema = z.object({
  openaiModel: z.enum(ALLOWED_MODELS).optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(1).max(32000).optional(),
});

router.get("/:botId/config", async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId;
    if (!botId || typeof botId !== "string") {
      return res.status(400).json({ ok: false, message: "missing_botId" });
    }

    // ensure bot exists
    const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true } });
    if (!bot) return res.status(404).json({ ok: false, message: "bot_not_found" });

    // find existing config (by botId relation)
    let cfg = await prisma.botConfig.findFirst({ where: { botId } });

    if (!cfg) {
      // create new config and connect to bot relation (important: use `bot: { connect: { id } }`)
      cfg = await prisma.botConfig.create({
        data: {
          ...defaultBotConfigFields,
          bot: { connect: { id: botId } }, // connect relation instead of passing botId directly
        },
      });
    }

    return res.json({ ok: true, config: cfg, allowedModels: ALLOWED_MODELS });
  } catch (err) {
    console.error("GET /admin/:botId/config error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

router.put("/:botId/config", async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId;
    if (!botId || typeof botId !== "string") {
      return res.status(400).json({ ok: false, message: "missing_botId" });
    }

    // validate request body
    const parsed = configUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: "invalid_input", issues: parsed.error.issues });
    }
    const updateData = parsed.data;

    // ensure bot exists
    const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true } });
    if (!bot) return res.status(404).json({ ok: false, message: "bot_not_found" });

    // Use upsert to either update an existing config or create a new one.
    // This is more concise and can be more performant.
    const result = await prisma.botConfig.upsert({
      where: { botId }, // Assumes botId is a unique field on BotConfig
      update: updateData,
      create: {
        ...defaultBotConfigFields,
        ...updateData,
        bot: { connect: { id: botId } },
      },
    });

    return res.json({ ok: true, config: result, allowedModels: ALLOWED_MODELS });
  } catch (err) {
    console.error("PUT /admin/:botId/config error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default router;
