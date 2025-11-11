// src/routes/admin/knowledge.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

/* ------------------------------- helpers -------------------------------- */
const s = (v: unknown) =>
  typeof v === "string" ? v.trim() : Array.isArray(v) ? String(v[0] ?? "").trim() : "";

const n = (v: unknown, def = 20, min = 1, max = 100) => {
  const x = Number(s(v) || v);
  return Math.min(Math.max(Number.isFinite(x) ? x : def, min), max);
};

const tenantOf = (req: Request) =>
  (req.headers["x-tenant"] as string | undefined)?.trim() || "bn9";

/* ------------------------------- schemas -------------------------------- */
const upsertSchema = z.object({
  title: z.string().min(1, "title_required"),
  tags: z.string().default(""),
  body: z.string().default(""),
  status: z.enum(["active", "draft", "archived"]).default("active"),
});
const partialSchema = upsertSchema.partial();

const linkSchema = z.object({
  docIds: z.array(z.string().min(1)).default([]),
});

/* -------------------------------- router -------------------------------- */
const r = Router();

/* ===== วาง /link ก่อนทุกอันที่มี '/:id' เพื่อกันชนเส้นทาง ===== */

/** GET /api/admin/ai/knowledge/link/:botId – รายการเอกสารที่ผูกกับบอท */
r.get("/link/:botId", async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId;
    const links = await prisma.botKnowledge.findMany({
      where: { botId },
      include: { doc: true }, // relation 'doc' ต้องมีใน schema ของ BotKnowledge
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      ok: true,
      botId,
      docIds: links.map((l) => l.docId),
      items: links.map((l) => l.doc),
    });
  } catch (err) {
    console.error("[knowledge][link:list]", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** POST /api/admin/ai/knowledge/link/:botId – แทนที่ลิงก์ทั้งหมดของบอท */
r.post("/link/:botId", async (req: Request, res: Response) => {
  try {
    const botId = req.params.botId;
    const parsed = linkSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ ok: false, message: "invalid_input", issues: parsed.error.issues });
    }
    const { docIds } = parsed.data;

    // ถ้าค่าว่าง ⇒ ล้างลิงก์ทั้งหมด
    if (docIds.length === 0) {
      await prisma.botKnowledge.deleteMany({ where: { botId } });
      return res.json({ ok: true, botId, docIds: [] });
    }

    // ตรวจว่าเอกสารมีจริง และเป็น tenant เดียวกัน
    const tenant = tenantOf(req);
    const exist = await prisma.knowledgeDoc.findMany({
      where: { id: { in: docIds }, tenant },
      select: { id: true },
    });
    const missing = docIds.filter((id) => !exist.some((e) => e.id === id));
    if (missing.length) {
      return res.status(400).json({ ok: false, message: "doc_not_found", missing });
    }

    // ลบเดิม + upsert ตามคู่ unique [botId, docId]
    await prisma.$transaction([
      prisma.botKnowledge.deleteMany({ where: { botId } }),
      ...docIds.map((docId) =>
        prisma.botKnowledge.upsert({
          where: { botId_docId: { botId, docId } }, // ต้องมี @@unique([botId, docId]) ใน prisma schema
          update: {},
          create: { botId, docId },
        })
      ),
    ]);

    return res.json({ ok: true, botId, docIds });
  } catch (err) {
    console.error("[knowledge][link:set]", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* ------------------------------ CRUD เอกสาร ------------------------------ */

/** GET /api/admin/ai/knowledge – ค้นหา/แบ่งหน้า */
r.get("/", async (req: Request, res: Response) => {
  try {
    const tenant = tenantOf(req);
    const q = s(req.query.q);
    const status = s(req.query.status);
    const page = n(req.query.page, 1, 1, 9999);
    const limit = n(req.query.limit, 20, 1, 100);
    const skip = (page - 1) * limit;

    // แยกเงื่อนไขค้นหา ลด ternary ซ้อน
    const hasQ = !!q;
    const orCond = hasQ
      ? ([
          { title: { contains: q, mode: "insensitive" as const } },
          { body: { contains: q, mode: "insensitive" as const } },
          { tags: { contains: q, mode: "insensitive" as const } },
        ] as const)
      : undefined;

    const where: any = {
      tenant,
      ...(status ? { status } : {}),
      ...(orCond ? { OR: orCond } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.knowledgeDoc.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.knowledgeDoc.count({ where }),
    ]);

    return res.json({
      ok: true,
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[knowledge][list]", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** GET /api/admin/ai/knowledge/:id – อ่านเอกสารเดี่ยว */
r.get("/:id", async (req: Request, res: Response) => {
  try {
    const tenant = tenantOf(req);
    const item = await prisma.knowledgeDoc.findFirst({
      where: { id: req.params.id, tenant },
    });
    if (!item) return res.status(404).json({ ok: false, message: "not_found" });
    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[knowledge][getOne]", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** POST /api/admin/ai/knowledge – สร้างเอกสาร */
r.post("/", async (req: Request, res: Response) => {
  try {
    const tenant = tenantOf(req);
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ ok: false, message: "invalid_input", issues: parsed.error.issues });
    }

    const item = await prisma.knowledgeDoc.create({
      data: { tenant, ...parsed.data },
    });

    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[knowledge][create]", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** PUT /api/admin/ai/knowledge/:id – แก้ไขเอกสาร */
r.put("/:id", async (req: Request, res: Response) => {
  try {
    const tenant = tenantOf(req);
    const exists = await prisma.knowledgeDoc.findFirst({
      where: { id: req.params.id, tenant },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ ok: false, message: "not_found" });

    const parsed = partialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ ok: false, message: "invalid_input", issues: parsed.error.issues });
    }

    const item = await prisma.knowledgeDoc.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[knowledge][update]", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** DELETE /api/admin/ai/knowledge/:id – ลบเอกสาร */
r.delete("/:id", async (req: Request, res: Response) => {
  try {
    const tenant = tenantOf(req);
    const exists = await prisma.knowledgeDoc.findFirst({
      where: { id: req.params.id, tenant },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ ok: false, message: "not_found" });

    await prisma.knowledgeDoc.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[knowledge][delete]", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default r;

