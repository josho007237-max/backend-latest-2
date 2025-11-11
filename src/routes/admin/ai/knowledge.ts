import { Router } from "express";
import { prisma } from "../../../lib/prisma";   // ถ้าใช้ db/prisma → "../../../db/prisma"
import { authGuard } from "../../../mw/auth";

const r = Router();
r.use(authGuard);

r.get("/", async (req, res) => {
  const tenant = (req.headers["x-tenant"] as string) || "bn9";
  const q = (req.query.q as string) || "";
  const tagsParam = (req.query.tags as string) || "";
  const status = (req.query.status as string) || "active";
  const sortRaw = (req.query.sort as string) || "updatedAt:desc";
  const [key, dir] = sortRaw.split(":") as ["updatedAt"|"createdAt"|"title","asc"|"desc"];

  const tagList = tagsParam ? tagsParam.split(",").map(s=>s.trim()).filter(Boolean) : [];
  const where:any = { tenant, status };
  if (q) where.OR = [{ title: { contains: q } }, { body: { contains: q } }, { tags: { contains: q } }];
  if (tagList.length) where.AND = tagList.map(t => ({ tags: { contains: t } }));

  const items = await prisma.knowledgeDoc.findMany({ where, orderBy: { [key]: dir } });
  res.json({ ok: true, items });
});

export default r;

