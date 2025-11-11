// src/routes/admin/bots.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import type { Bot } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { z } from "zod";
import { sseHub } from "../../lib/sseHub";

/**
 * Allowed OpenAI model list (ปรับเพิ่ม/ลดได้ตามระบบที่รองรับ)
 * NOTE: Prisma ใช้ฟิลด์ชื่อ `model` ใน BotConfig
 */
const ALLOWED_MODELS = ["gpt-4o-mini", "gpt-4o", "o4-mini", "gpt-3.5-turbo"] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];

/**
 * ค่าเริ่มต้นของ BotConfig (ห้ามใส่ฟิลด์ relation ที่นี่)
 */
const defaultBotConfigFields = {
  model: "gpt-4o-mini" as AllowedModel,
  systemPrompt: "",
  temperature: 0.3,
  topP: 1,
  maxTokens: 800,
};

const router = Router();

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Middleware: ดึง bot จาก :id หรือ :botId แล้วแนบไว้ที่ req.bot */
async function findBot(
  req: Request & { bot?: Bot },
  res: Response,
  next: NextFunction
) {
  const botId = (req.params.id ?? req.params.botId) as string | undefined;
  if (!botId || typeof botId !== "string") {
    return res.status(400).json({ ok: false, message: "missing_botId" });
  }

  try {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return res.status(404).json({ ok: false, message: "bot_not_found" });
    req.bot = bot;
    return next();
  } catch (err) {
    console.error("[findBot] error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
}

/* -------------------------------------------------------------------------- */
/*                             /api/admin/bots/*                              */
/* -------------------------------------------------------------------------- */

/** GET /api/admin/bots – รายการบอท (ฟิลด์ไม่อ่อนไหว) */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const items = await prisma.bot.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenant: true,
        name: true,
        platform: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        verifiedAt: true,
      },
    });
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /admin/bots error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** GET /api/admin/bots/:id – อ่านบอทตัวเดียว (ฟิลด์ไม่อ่อนไหว) */
router.get("/:id", findBot, async (req: Request, res: Response) => {
  return res.json({ ok: true, bot: (req as any).bot as Bot });
});

/** PATCH /api/admin/bots/:id – อัปเดตสถานะ/ชื่อ/verifiedAt */
router.patch("/:id", findBot, async (req: Request, res: Response): Promise<any> => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      active: z.boolean().optional(),
      verifiedAt: z.string().datetime().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ ok: false, message: "invalid_input", issues: parsed.error.issues });
    }

    const before = (req as any).bot as Bot;
    const updated = await prisma.bot.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: {
        id: true,
        tenant: true,
        name: true,
        platform: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        verifiedAt: true,
      },
    });

    // หาก verifiedAt ถูกตั้งใหม่ → broadcast แจ้ง Dashboard
    if (!before.verifiedAt && updated.verifiedAt) {
      sseHub.broadcast({
        type: "bot:verified",
        tenant: updated.tenant,
        botId: updated.id,
        at: new Date().toISOString(),
      });
    }

    return res.json({ ok: true, bot: updated });
  } catch (err) {
    console.error("PATCH /admin/bots/:id error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** POST /api/admin/bots/init – สร้างบอทเริ่มต้น (กันซ้ำด้วย tenant+name) */
router.post("/init", async (_req: Request, res: Response) => {
  try {
    const TENANT = "bn9";
    const NAME = "admin-bot-001";

    const existed = await prisma.bot.findFirst({
      where: { tenant: TENANT, name: NAME },
      select: {
        id: true,
        tenant: true,
        name: true,
        platform: true,
        active: true,
        createdAt: true,
      },
    });
    if (existed) return res.json({ ok: true, bot: existed });

    const bot = await prisma.bot.create({
      data: { tenant: TENANT, name: NAME, platform: "line", active: true },
      select: {
        id: true,
        tenant: true,
        name: true,
        platform: true,
        active: true,
        createdAt: true,
      },
    });

    return res.json({ ok: true, bot });
  } catch (e: any) {
    // กัน race condition (unique constraint)
    if ((e as any)?.code === "P2002") {
      const bot = await prisma.bot.findFirst({
        where: { tenant: "bn9", name: "admin-bot-001" },
        select: {
          id: true,
          tenant: true,
          name: true,
          platform: true,
          active: true,
          createdAt: true,
        },
      });
      if (bot) return res.json({ ok: true, bot });
    }

    console.error("POST /admin/bots/init error:", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* ------------------------------- Secrets ---------------------------------- */

/**
 * GET /api/admin/bots/:id/secrets – คืน secrets แบบ mask (ไม่ส่งค่า plaintext)
 */
router.get("/:id/secrets", findBot, async (req: Request, res: Response) => {
  try {
    const botId = req.params.id;
    const sec = await prisma.botSecret.findUnique({ where: { botId } });

    return res.json({
      ok: true,
      lineAccessToken: sec?.channelAccessToken ? "********" : "",
      lineChannelSecret: sec?.channelSecret ? "********" : "",
      openaiApiKey: sec?.openaiApiKey ? "********" : "",
    });
  } catch (err) {
    console.error("GET /admin/bots/:id/secrets error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/**
 * POST /api/admin/bots/:id/secrets – upsert secrets (create if missing, update if exists)
 * body: { openaiApiKey?, lineAccessToken?, lineChannelSecret? }
 */
router.post("/:id/secrets", findBot, async (req: Request, res: Response) => {
  try {
    const { openaiApiKey, lineAccessToken, lineChannelSecret } = req.body as {
      openaiApiKey?: string | null;
      lineAccessToken?: string | null;
      lineChannelSecret?: string | null;
    };

    const sanitize = (s?: string | null) =>
      typeof s === "string" && s.trim() && s.trim() !== "******" ? s.trim() : undefined;

    const update: {
      openaiApiKey?: string | null;
      channelAccessToken?: string | null;
      channelSecret?: string | null;
    } = {};

    const oa = sanitize(openaiApiKey);
    const lat = sanitize(lineAccessToken);
    const lcs = sanitize(lineChannelSecret);

    if (oa !== undefined) update.openaiApiKey = oa;
    if (lat !== undefined) update.channelAccessToken = lat;
    if (lcs !== undefined) update.channelSecret = lcs;

    const botId = req.params.id;

    const secretRow = await prisma.botSecret.upsert({
      where: { botId },
      update,
      create: {
        bot: { connect: { id: botId } },
        openaiApiKey: update.openaiApiKey ?? null,
        channelAccessToken: update.channelAccessToken ?? null,
        channelSecret: update.channelSecret ?? null,
      },
      select: { channelAccessToken: true, channelSecret: true, openaiApiKey: true },
    });

    // อัปเดตเวลา verifiedAt เมื่อบอทมี LINE token + secret ครบ
    const hasLine = Boolean(secretRow.channelAccessToken) && Boolean(secretRow.channelSecret);
    if (hasLine) {
      const updated = await prisma.bot.update({
        where: { id: botId },
        data: { verifiedAt: new Date() },
        select: { id: true, tenant: true },
      });

      // Broadcast ให้ Dashboard เด้งสถานะ
      sseHub.broadcast({
        type: "bot:verified",
        tenant: updated.tenant,
        botId: updated.id,
        at: new Date().toISOString(),
      });
    }

    return res.json({ ok: true, botId });
  } catch (err) {
    console.error("POST /admin/bots/:id/secrets error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* --------------------------- Bot Config (AI) --------------------------- */

const configUpdateSchema = z.object({
  model: z.enum(ALLOWED_MODELS).optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(1).max(32000).optional(),
});

/** GET /api/admin/bots/:botId/config – อ่าน (หรือสร้างถ้ายังไม่มี) */
router.get("/:botId/config", findBot, async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId;

    let cfg = await prisma.botConfig.findFirst({ where: { botId } });
    if (!cfg) {
      cfg = await prisma.botConfig.create({
        data: {
          ...defaultBotConfigFields,
          bot: { connect: { id: botId } },
        },
      });
    }

    return res.json({ ok: true, config: cfg, allowedModels: ALLOWED_MODELS });
  } catch (err) {
    console.error("GET /admin/:botId/config error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** PUT /api/admin/bots/:botId/config – อัปเดต/สร้าง BotConfig */
router.put("/:botId/config", findBot, async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId;

    const parsed = configUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ ok: false, message: "invalid_input", issues: parsed.error.issues });
    }
    const updateData = parsed.data;

    const updatedConfig = await prisma.botConfig.upsert({
      where: { botId },
      update: updateData,
      create: {
        ...defaultBotConfigFields,
        ...updateData,
        bot: { connect: { id: botId } },
      },
    });

    return res.json({ ok: true, config: updatedConfig, allowedModels: ALLOWED_MODELS });
  } catch (err) {
    console.error("PUT /admin/:botId/config error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default router;
