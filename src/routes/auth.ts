// src/routes/auth.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { signJwt } from "../lib/jwt";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(3),
});

router.post("/login", (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ ok: false, message: "invalid_input", issues: parsed.error.issues });
  }

  const { email, password } = parsed.data;

  // Demo credential (ภายหลังค่อยเปลี่ยนเป็นตรวจจากฐานข้อมูล/Prisma)
  if (email !== "root@bn9.local" || password !== "bn9@12345") {
    return res.status(401).json({ ok: false, message: "invalid_credential" });
  }

  // ใช้ JWT_EXPIRE (หลัก) และรองรับ JWT_EXPIRES เผื่อบางเครื่องตั้งค่าผิดชื่อ
  const expiresIn = (config.JWT_EXPIRE ?? (config as any).JWT_EXPIRES ?? "1d") as
    | string
    | number;

  const token = signJwt(
    { email, roles: ["admin"], tenant: "bn9" },
    { expiresIn, subject: "admin-api" }
  );

  return res.json({ ok: true, token });
});

export default router;
