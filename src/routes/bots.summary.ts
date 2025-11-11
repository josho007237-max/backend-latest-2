import { Router } from "express";
import { prisma } from "../lib/prisma";   // ถ้าพี่เก็บไว้ที่ src/db/prisma.ts → "../db/prisma"
import { authGuard } from "../mw/auth";

const r = Router();
r.use(authGuard);

const mask = (v?: string | null) => {
  if (!v) return null;
  return v.length <= 6 ? "*".repeat(v.length) : v.slice(0,3) + "***" + v.slice(-3);
};

r.get("/:id/summary", async (req, res) => {
  const id = req.params.id;
  const bot = await prisma.bot.findUnique({ where: { id }, include: { config: true, secrets: true } });
  if (!bot) return res.status(404).json({ ok: false, code: "not_found", message: "bot not found" });

  const secrets = bot.secrets ? {
    channelSecret: mask((bot.secrets as any).channelSecret),
    channelAccessToken: mask((bot.secrets as any).channelAccessToken),
    openaiApiKey: mask((bot.secrets as any).openaiApiKey),
  } : null;

  res.json({ ok: true, bot: { id: bot.id, name: bot.name, platform: bot.platform }, config: bot.config, secrets });
});

export default r;
