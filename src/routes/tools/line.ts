// src/routes/tools/line.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";

const router = Router();

async function handlePing(req: Request, res: Response) {
  try {
    const botId = req.params.botId;
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) {
      return res.status(404).json({ ok: false, status: 404, message: "bot_not_found" });
    }
    const sec = await prisma.botSecret.findUnique({ where: { botId } });
    if (!sec?.channelAccessToken) {
      return res.status(400).json({ ok: false, status: 400, message: "missing_access_token" });
    }
    const r = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${sec.channelAccessToken}` },
    });
    return res.json({ ok: r.ok, status: r.status });
  } catch (e) {
    console.error("[line-ping] error", e);
    return res.status(500).json({ ok: false, status: 500, message: "internal_error" });
  }
}

router.get("/line-ping/:botId", handlePing);
router.get("/dev/line-ping/:botId", handlePing); // fallback for old path

export default router;
