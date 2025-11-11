import { Router, type Request, type Response } from "express";
import bots from "./bots";
import presets from "./presets";
import knowledge from "./knowledge";

const router = Router();

/** ping root ของ admin area: GET /api/admin */
router.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, area: "admin" });
});

/** กลุ่มจัดการบอท (secrets / config / knowledge ของบอท) */
router.use("/bots", bots);

/** กลุ่ม Presets ของ AI (tenant scope) */
router.use("/ai/presets", presets);

/** กลุ่ม Knowledge (tenant scope) — เลือก path นี้อันเดียวพอ */
router.use("/ai/knowledge", knowledge);
// ถ้าต้องการทางลัดเพิ่มเติม ค่อยเพิ่ม alias ด้านล่าง (ไม่บังคับ):
// router.use("/knowledge", knowledge);

export default router;
