// src/routes/bots.ts
import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const r = Router();

/** GET /api/bots — รายชื่อบอททั้งหมด (เรียงใหม่สุดก่อน) */
r.get("/", async (_req: Request, res: Response) => {
  try {
    const items = await prisma.bot.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenant: true,
        name: true,
        platform: true,
        active: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/bots error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** POST /api/bots/init — สร้างบอทเริ่มต้น 1 ตัว (กันซ้ำด้วย tenant+name) */
r.post("/init", async (_req: Request, res: Response) => {
  const tenant = "bn9";
  const name = "admin-bot-001";

  try {
    // ถ้ามีแล้วก็คืนตัวเดิมกลับไป
    const existed = await prisma.bot.findFirst({
      where: { tenant, name },
      select: { id: true, tenant: true, name: true, platform: true, active: true, createdAt: true },
    });
    if (existed) return res.json({ ok: true, bot: existed });

    // create (ไม่ส่ง platform หากต้องการใช้ default จาก schema)
    const bot = await prisma.bot.create({
      data: { tenant, name, active: true },
      select: { id: true, tenant: true, name: true, platform: true, active: true, createdAt: true },
    });
    return res.json({ ok: true, bot });
  } catch (e: any) {
    // เผื่อชน unique constraint (race)
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === "P2002") {
      const bot = await prisma.bot.findFirst({
        where: { tenant, name },
        select: { id: true, tenant: true, name: true, platform: true, active: true, createdAt: true },
      });
      if (bot) return res.json({ ok: true, bot });
    }
    console.error("POST /api/bots/init error:", e);
    return res.status(500).json({ ok: false, message: "create_failed" });
  }
});

/** PATCH /api/bots/:id — เปลี่ยนชื่อ/สถานะ */
r.patch("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id || typeof id !== "string") return res.status(400).json({ ok: false, message: "missing_botId" });

  const body = req.body ?? {};
  const data: Prisma.BotUpdateInput = {};

  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 60);
  if (typeof body.active === "boolean") data.active = body.active;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ ok: false, message: "nothing_to_update" });
  }

  try {
    const bot = await prisma.bot.update({
      where: { id },
      data,
      select: {
        id: true,
        tenant: true,
        name: true,
        platform: true,
        active: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json({ ok: true, bot });
  } catch (err) {
    console.error("PATCH /api/bots/:id error:", err);
    return res.status(404).json({ ok: false, message: "not_found" });
  }
});

/** DELETE /api/bots/:id — ลบทั้งบอท (child จะ cascade ตาม schema) */
r.delete("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id || typeof id !== "string") return res.status(400).json({ ok: false, message: "missing_botId" });

  try {
    await prisma.bot.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/bots/:id error:", err);
    return res.status(404).json({ ok: false, message: "not_found" });
  }
});

/** GET /api/bots/:id/secrets — ดึงค่าแบบ masked */
r.get("/:id/secrets", async (req: Request, res: Response) => {
  const botId = req.params.id;
  if (!botId || typeof botId !== "string") return res.status(400).json({ ok: false, message: "missing_botId" });

  try {
    const sec = await prisma.botSecret.findUnique({ where: { botId } });

    return res.json({
      ok: true,
      openaiApiKey: sec?.openaiApiKey ? "********" : "",
      lineAccessToken: sec?.channelAccessToken ? "********" : "",
      lineChannelSecret: sec?.channelSecret ? "********" : "",
    });
  } catch (err) {
    console.error("GET /api/bots/:id/secrets error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** POST /api/bots/:id/secrets — upsert (LINE + OpenAI) */
r.post("/:id/secrets", async (req: Request, res: Response) => {
  const botId = req.params.id;
  if (!botId || typeof botId !== "string") return res.status(400).json({ ok: false, message: "missing_botId" });

  const {
    openaiApiKey,
    lineAccessToken,
    lineChannelSecret,
  }: {
    openaiApiKey?: string | null;
    lineAccessToken?: string | null;
    lineChannelSecret?: string | null;
  } = req.body ?? {};

  // build update object only from provided fields
  const updateData: Prisma.BotSecretUpdateInput = {};
  if (typeof openaiApiKey === "string" && openaiApiKey.trim()) updateData.openaiApiKey = openaiApiKey.trim();
  if (typeof lineAccessToken === "string" && lineAccessToken.trim())
    updateData.channelAccessToken = lineAccessToken.trim();
  if (typeof lineChannelSecret === "string" && lineChannelSecret.trim())
    updateData.channelSecret = lineChannelSecret.trim();

  try {
    // Ensure bot exists first
    const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true } });
    if (!bot) return res.status(404).json({ ok: false, message: "bot_not_found" });

    // Find existing secret by botId
    const existing = await prisma.botSecret.findUnique({ where: { botId } });

    if (existing) {
      // update only provided fields (Prisma will ignore empty object)
      if (Object.keys(updateData).length === 0) {
        return res.json({ ok: true, botId }); // nothing to change
      }
      await prisma.botSecret.update({
        where: { botId },
        data: updateData,
      });
    } else {
      // create new BotSecret and connect to the bot
      await prisma.botSecret.create({
        data: {
          bot: { connect: { id: botId } },
          openaiApiKey: (updateData as any).openaiApiKey ?? null,
          channelAccessToken: (updateData as any).channelAccessToken ?? null,
          channelSecret: (updateData as any).channelSecret ?? null,
        },
      });
    }

    return res.json({ ok: true, botId });
  } catch (err) {
    console.error("POST /api/bots/:id/secrets error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default r;
