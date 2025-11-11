// src/server.ts

/* ---------------------- Catch unexpected process errors --------------------- */
process.on("unhandledRejection", (err) =>
  console.error("[UNHANDLED REJECTION]", err)
);
process.on("uncaughtException", (err) =>
  console.error("[UNCAUGHT EXCEPTION]", err)
);

/* --------------------------------- Imports --------------------------------- */
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { ZodError } from "zod";

/* Config & middlewares */
import { config } from "./config";
import { logger } from "./mw/logger";
import { authGuard } from "./mw/auth";

/* Core routes */
import health from "./routes/health";
import authRoutes from "./routes/auth";
import botsRoutes from "./routes/bots";
import casesRoutes from "./routes/cases";
import statsRoutes from "./routes/stats";

/* Extra routes */
import aiAnswerRoute from "./routes/ai/answer";
import botsSummary from "./routes/bots.summary";
import lineTools from "./routes/tools/line";

/* Webhooks */
import lineWebhook from "./routes/webhooks/line";
import fbWebhook from "./routes/webhooks/facebook";
import tgWebhook from "./routes/webhooks/telegram";

/* Realtime */
import { events as eventsRouter } from "./routes/events"; // GET /api/events?tenant=bn9
import { live } from "./routes/live";                      // GET /api/live/:tenant (SSE)
import { dev } from "./routes/dev";

/* Admin */
import adminRouter from "./routes/admin";
import presetsAdmin from "./routes/admin/ai/presets";
import knowledgeAdmin from "./routes/admin/ai/knowledge";

/* ---------------------------------- Boot ---------------------------------- */
dotenv.config();

const app = express();
app.set("trust proxy", 1);

/* ----------------------------- Body Parsers -------------------------------- */
/** ต้องมาก่อน express.json: เก็บ raw body สำหรับตรวจลายเซ็น LINE */
app.use("/api/webhooks/line", express.raw({ type: "application/json" }));

/** Parsers ทั่วไป */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));

/** จัดการ error จาก body parser (payload ใหญ่ / JSON แตก) */
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ ok: false, message: "payload_too_large" });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, message: "invalid_json" });
  }
  return next(err);
});

/* --------------------------- Security / CORS / Log ------------------------- */
const allowListSet = new Set(
  (config.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowListSet.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant"],
  })
);

app.use(morgan("dev"));
app.use(logger);

/* ------------------------------ Rate Limiter ------------------------------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // อย่าลิมิต webhooks/health/SSE
  skip: (req: Request) =>
    req.path.startsWith("/api/webhooks/") ||
    req.path === "/api/health" ||
    req.path.startsWith("/api/events") ||
    req.path.startsWith("/api/live/"),
});
app.use("/api", limiter);

/* --------------------------------- Routes --------------------------------- */
/** Tools */
app.use("/api", lineTools);

/** Health */
app.use("/api/health", health);

/** Auth */
app.use("/api/auth", authRoutes);

/** Core business */
app.use("/api/bots", botsRoutes);
app.use("/api/cases", casesRoutes);
app.use("/api/stats", statsRoutes);

/** สรุปบอท (config + masked secrets) */
app.use("/api/bots", botsSummary);

/** AI Answer (per-bot config / RAG) */
app.use("/api/ai/answer", aiAnswerRoute);

/** Realtime (SSE) - ติดตั้งครั้งเดียว (ไม่มีซ้ำ) */
app.use("/api", eventsRouter); // GET /api/events?tenant=bn9
app.use("/api", live);         // GET /api/live/:tenant
app.use("/api", dev);          // /api/dev/* (ทดสอบ)

/** Webhooks */
app.use("/api/webhooks/line", lineWebhook);
app.use("/api/webhooks/facebook", fbWebhook);
app.use("/api/webhooks/telegram", tgWebhook);

/* ------------------------------ Admin (JWT) -------------------------------- */
/** เปิดเฉพาะเมื่อ .env ตั้ง ENABLE_ADMIN_API=1 */
if (config.ENABLE_ADMIN_API === "1") {
  console.log("[BOOT] Admin API enabled (guarded by JWT)");
  app.use("/api/admin", authGuard, adminRouter);
  app.use("/api/admin/ai/presets", authGuard, presetsAdmin);
  app.use("/api/admin/ai/knowledge", authGuard, knowledgeAdmin);
}

/* ------------------------------ 404 & Errors ------------------------------- */
// 404 เฉพาะเส้นทาง /api/*
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ ok: false, message: "not_found" });
});

/** Global error handler (ท้ายสุด) */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ ok: false, message: "invalid_input", issues: err.issues });
  }
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ ok: false, message: "invalid_json" });
  }
  console.error("[INTERNAL ERROR]", err);
  return res.status(500).json({ ok: false, message: "internal_error" });
});

/* -------------------------- Dev: print routes (optional) ------------------- */
function printRoutes(appInstance: any) {
  try {
    const rows: Array<{ method: string; path: string }> = [];
    const dig = (stack: any[], base = "") => {
      for (const layer of stack) {
        if (layer.route?.path) {
          const methods = Object.keys(layer.route.methods);
          for (const m of methods)
            rows.push({ method: m.toUpperCase(), path: base + layer.route.path });
        } else if (layer.name === "router" && layer.handle?.stack) {
          // แปลง RegExp ของ path ที่ mount ให้เป็นข้อความอ่านง่าย
          const mount = (layer.regexp?.source ?? "")
            .replace(/\\\//g, "/")
            .replace(/^\^/g, "")
            .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ":param")
            .replace(/\(\?:\(\[\^\\\/]\*\)\)/g, "*")
            .replace(/\$$/g, "");
          dig(layer.handle.stack, base + (mount.endsWith("/") ? mount.slice(0, -1) : mount));
        }
      }
    };
    // @ts-ignore
    dig(appInstance._router?.stack ?? []);
    console.log("[ROUTES]");
    for (const r of rows) console.log(`${r.method.padEnd(6)} ${r.path}`);
  } catch {
    // quiet
  }
}
if (config.isDev) setTimeout(() => printRoutes(app), 200);

/* --------------------------------- Listen --------------------------------- */
const PORT = Number(config.PORT ?? process.env.PORT ?? 3000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BN9 backend listening on :${PORT}`);
});

export default app;
