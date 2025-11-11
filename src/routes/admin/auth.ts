import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signJwt, verifyJwt } from "../../lib/jwt";
import { config } from "../../config";

const router = Router();

/* ---------- Schemas ---------- */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/* ---------- Helpers ---------- */
type AuthPayload = { sub: string; email: string; roles: string[] };

const signOptions = { expiresIn: config.JWT_EXPIRE as string | number, subject: "admin-1" };

/* ---------- POST /api/admin/auth/login ---------- */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: "invalid_input", issues: parsed.error.issues });
    }
    const { email, password } = parsed.data;

    // ดึงเฉพาะฟิลด์ที่มีอยู่จริงใน Prisma schema
    const user = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true, email: true, password: true }, // <— ไม่ select roles ถ้า schema ไม่มี
    });
    if (!user) return res.status(401).json({ ok: false, message: "invalid_credentials" });

    const ok = await bcrypt.compare(password, user.password ?? "");
    if (!ok) return res.status(401).json({ ok: false, message: "invalid_credentials" });

    const payload: AuthPayload = { sub: String(user.id), email: user.email, roles: [] }; // roles ว่างไว้ก่อน
    const token = signJwt(payload, signOptions);

    const safeUser = { id: user.id, email: user.email, roles: [] as string[] };
    return res.json({ ok: true, token, user: safeUser });
  } catch (err) {
    console.error("POST /api/admin/auth/login error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* ---------- JWT Guard (export) ---------- */
export const adminJwtGuard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, message: "missing_authorization" });
    }
    const token = auth.split(" ")[1]!;
    const decoded = verifyJwt<AuthPayload>(token);
    (req as any).authPayload = decoded;
    return next();
  } catch (err) {
    console.error("adminJwtGuard error:", err);
    return res.status(401).json({ ok: false, message: "invalid_token" });
  }
};

export default router;
