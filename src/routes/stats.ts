// src/routes/stats.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";

const r = Router();

const todayKey = () => new Date().toISOString().slice(0, 10);
const getStr = (q: unknown) =>
  typeof q === "string" ? q.trim() : Array.isArray(q) ? String(q[0] ?? "").trim() : "";

r.get("/daily", async (req: Request, res: Response) => {
  try {
    const botId = getStr(req.query.botId);
    const dateKey = getStr(req.query.dateKey) || todayKey();
    if (!botId) return res.status(400).json({ ok: false, message: "missing_botId" });

    const row = await prisma.statDaily.findUnique({
      where: { botId_dateKey: { botId, dateKey } },
      select: { botId: true, dateKey: true, total: true, text: true, follow: true, unfollow: true },
    });

    return res.json({
      ok: true,
      dateKey,
      stats: row ?? { botId, dateKey, total: 0, text: 0, follow: 0, unfollow: 0 },
    });
  } catch (e) {
    console.error("[/stats/daily]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

r.get("/range", async (req: Request, res: Response) => {
  try {
    const botId = getStr(req.query.botId);
    const from = getStr(req.query.from);
    const to = getStr(req.query.to);
    if (!botId) return res.status(400).json({ ok: false, message: "missing_botId" });

    const where: any = { botId };
    if (from || to) {
      where.dateKey = {};
      if (from) where.dateKey.gte = from;
      if (to) where.dateKey.lte = to;
    }

    const items = await prisma.statDaily.findMany({
      where,
      orderBy: { dateKey: "asc" },
      select: { dateKey: true, total: true, text: true, follow: true, unfollow: true },
    });

    type Summary = { total: number; text: number; follow: number; unfollow: number };
    const summary = items.reduce<Summary>(
      (a, x) => ({
        total: a.total + (x.total ?? 0),
        text: a.text + (x.text ?? 0),
        follow: a.follow + (x.follow ?? 0),
        unfollow: a.unfollow + (x.unfollow ?? 0),
      }),
      { total: 0, text: 0, follow: 0, unfollow: 0 }
    );

    return res.json({ ok: true, items, summary });
  } catch (e) {
    console.error("[/stats/range]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default r;
