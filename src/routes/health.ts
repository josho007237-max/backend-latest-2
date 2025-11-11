import { Router } from "express";
const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), adminApi: process.env.ENABLE_ADMIN_API === "1" });
});

export default router;
