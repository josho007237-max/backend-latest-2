import { Router } from "express";
import { prisma } from "../../../lib/prisma";   // ถ้าใช้ db/prisma → "../../../db/prisma"
import { authGuard } from "../../../mw/auth";

const r = Router();
r.use(authGuard);

r.get("/", async (req, res) => {
  const tenant = (req.headers["x-tenant"] as string) || "bn9";
  const status = (req.query.status as string) || "active";
  const items = await prisma.aiPreset.findMany({ where: { tenant, status }, orderBy: { updatedAt: "desc" } });
  res.json({ ok: true, items });
});

r.get("/:id", async (req, res) => {
  const item = await prisma.aiPreset.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ ok: false, code: "not_found", message: "preset not found" });
  res.json({ ok: true, item });
});

r.patch("/:id/archive", async (req, res) => {
  const item = await prisma.aiPreset.update({ where: { id: req.params.id }, data: { status: "archived" } });
  res.json({ ok: true, item });
});

export default r;
