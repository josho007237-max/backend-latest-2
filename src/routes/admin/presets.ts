// src/routes/admin/presets.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

const router = Router();
const getTenant = (req: Request) => (req.header("x-tenant") || "bn9").trim();

const SavePreset = z.object({
  name: z.string().min(1),
  systemPrompt: z.string().default(""),
  model: z.string().min(1).default("gpt-4o-mini"),
  temperature: z.coerce.number().min(0).max(2).default(0.3),
  topP: z.coerce.number().min(0).max(1).default(1),
  maxTokens: z.coerce.number().int().min(1).max(8192).default(800),
});

router.get("/", async (req: Request, res: Response) => {
  const tenant = getTenant(req);
  const items = await prisma.aiPreset.findMany({
    where: { tenant },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ ok: true, items });
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const input = SavePreset.parse(req.body);

    // ป้องกันชื่อซ้ำภายใต้ tenant เดียวกัน
    const existed = await prisma.aiPreset.findFirst({
      where: { tenant, name: input.name },
    });
    if (existed) {
      return res.status(200).json({ ok: true, item: existed, existed: true });
    }

    const item = await prisma.aiPreset.create({
      data: {
        tenant,
        name: input.name,
        systemPrompt: input.systemPrompt,
        model: input.model,
        temperature: input.temperature,
        topP: input.topP,
        maxTokens: input.maxTokens,
      },
    });

    return res.json({ ok: true, item });
  } catch (e) {
    console.error("[POST /admin/ai/presets]", e);
    return res.status(400).json({ ok: false, message: "invalid_input" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const input = SavePreset.partial().parse(req.body);
    const item = await prisma.aiPreset.update({ where: { id }, data: input });
    return res.json({ ok: true, item });
  } catch (e) {
    console.error("[PATCH /admin/ai/presets/:id]", e);
    return res.status(400).json({ ok: false, message: "invalid_input" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.aiPreset.delete({ where: { id } });
    return res.json({ ok: true, deleted: 1 });
  } catch (e) {
    console.error("[DELETE /admin/ai/presets/:id]", e);
    return res.status(400).json({ ok: false, message: "invalid_input" });
  }
});

export default router;
