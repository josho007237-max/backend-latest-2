// src/routes/dev.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";

export const dev = Router();

dev.get("/dev/line-ping/:botId", async (req: Request, res: Response) => {
  const botId = req.params.botId ?? "";
  if (!botId) return res.status(400).json({ ok: false, message: "missing_botId" });

  const secrets = await prisma.botSecret.findUnique({ where: { botId } });
  const accessToken =
    (secrets as any)?.channelAccessToken ??
    (secrets as any)?.lineAccessToken ?? "";

  if (!accessToken) return res.status(400).json({ ok: false, message: "missing_access_token" });

  try {
    const r = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const info = await r.json().catch(() => ({}));
    return res.status(200).json({ ok: r.ok, status: r.status, info });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: "line_ping_failed", error: String(e?.message ?? e) });
  }
});

dev.post("/dev/ai-test", async (req: Request, res: Response) => {
  const q = String(req.body?.q ?? "");
  const botId = String(req.body?.botId ?? "dev-bot");
  if (!q) return res.status(400).json({ ok: false, message: "missing_q" });

  const cfg = await prisma.botConfig.findUnique({ where: { botId } });
  return res.status(200).json({
    ok: true,
    echo: q,
    using: {
      model: cfg?.openaiModel ?? "gpt-4o-mini",
      temperature: cfg?.temperature ?? 0.3,
      topP: cfg?.topP ?? 1,
      maxTokens: cfg?.maxTokens ?? 800,
    },
  });
});

export default dev;
