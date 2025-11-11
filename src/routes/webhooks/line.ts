// src/routes/webhooks/line.ts
import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";
import { askPloy } from "../../services/ai";
import { defaultSystemPrompt } from "../../services/prompt";

const router = Router();

/* ------------------------------- Utilities -------------------------------- */

function getRawBody(req: Request): Buffer | null {
  // เส้นทางนี้ถูกผูกด้วย express.raw({ type: "application/json" }) ใน server.ts
  const b: unknown = (req as any).body;
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === "string") return Buffer.from(b);
  return null;
}

/** Verify LINE signature (skip เมื่อ LINE_DEV_SKIP_VERIFY=1) */
function verifyLineSignature(req: Request, channelSecret?: string): boolean {
  if (config.LINE_DEV_SKIP_VERIFY === "1") return true;

  const secret = channelSecret ?? config.LINE_CHANNEL_SECRET;
  const sig = req.headers["x-line-signature"];
  const raw = getRawBody(req);

  if (!secret || !sig || !raw) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  return expected === sig;
}

/* ------------------------------- LINE Types ------------------------------- */
type LineSource = {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
};

type LineMessage = { id?: string; type: string; text?: string };

type LineEvent = {
  type: "message" | string;
  replyToken?: string;
  timestamp: number;
  source?: LineSource;
  message?: LineMessage;
};

function isTextMessage(m: unknown): m is { type: "text"; text: string } {
  const x = m as any;
  return x && x.type === "text" && typeof x.text === "string";
}

/* ------------------------------ Classifier -------------------------------- */
function classify(t0: string) {
  const t = (t0 || "").toLowerCase();
  if (["ฝากไม่เข้า", "เครดิตไม่เข้า", "เติมไม่เข้า", "ฝากเงิน", "เติมเงิน", "ฝาก"].some(k => t.includes(k)))
    return "deposit" as const;
  if (["ถอนไม่ได้", "ถอนเงิน", "ถอนช้า", "ถอนไม่ออก", "ถอน"].some(k => t.includes(k)))
    return "withdraw" as const;
  if (["ยืนยันตัวตน", "เอกสาร", "บัตรประชาชน", "kyc"].some(k => t.includes(k)))
    return "kyc" as const;
  if (["สมัครสมาชิก", "สมัคร", "เปิดยูส", "เปิด user", "เปิดยูสเซอร์"].some(k => t.includes(k)))
    return "register" as const;
  return "other" as const;
}

/* ------------------------------ Bot resolver ------------------------------ */
async function resolveBot(tenant: string) {
  const bot =
    (await prisma.bot.findFirst({
      where: { tenant, platform: "line", active: true },
      select: { id: true },
    })) ??
    (await prisma.bot.findFirst({
      where: { tenant, platform: "line" },
      select: { id: true },
    }));

  if (!bot?.id) return null;

  const sec = await prisma.botSecret.findFirst({
    where: { botId: bot.id },
    select: { channelSecret: true, channelAccessToken: true, openaiApiKey: true },
  });

  const cfg = await prisma.botConfig.findFirst({
    where: { botId: bot.id },
    select: { systemPrompt: true, model: true, temperature: true, topP: true, maxTokens: true },
  });

  return {
    botId: bot.id,
    channelSecret: sec?.channelSecret ?? "",
    channelAccessToken: sec?.channelAccessToken ?? "",
    openaiApiKey: sec?.openaiApiKey ?? "",
    systemPrompt: cfg?.systemPrompt ?? "",
  };
}

/* ------------------------------ LINE Reply API ---------------------------- */
async function lineReply(
  replyToken: string,
  channelAccessToken: string,
  text: string
): Promise<boolean> {
  const resp = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.warn("[LINE reply warning]", resp.status, t);
    return false;
  }
  return true;
}

/* --------------------------------- Route ---------------------------------- */
/** POST /api/webhooks/line — handle LINE webhook events */
router.post("/", async (req: Request, res: Response) => {
  try {
    const tenant = (req.headers["x-tenant"] as string) || config.TENANT_DEFAULT || "bn9";

    // เลือกบอทตาม tenant เพื่อนำ secret มา verify
    const picked = await resolveBot(tenant);
    if (!picked) return res.status(400).json({ ok: false, message: "line_bot_not_configured" });

    // Verify signature ด้วย secret ของบอท (หรือ global)
    if (!verifyLineSignature(req, picked.channelSecret)) {
      return res.status(401).json({ ok: false, message: "invalid_signature" });
    }

    // Parse JSON payload (ตอนนี้ปลอดภัยแล้ว)
    let payload: any = (req as any).body;
    if (Buffer.isBuffer(payload)) {
      try {
        payload = JSON.parse(payload.toString("utf8"));
      } catch {
        payload = null;
      }
    }

    const { botId, channelAccessToken, openaiApiKey, systemPrompt } = picked;
    const events: LineEvent[] = payload?.events ?? [];
    if (!events.length) return res.status(200).json({ ok: true, noEvents: true });

    // Detect LINE redelivery (duplicate message)
    const isRetry = Boolean(req.headers["x-line-retry-key"]);
    const results: Array<Record<string, unknown>> = [];

    for (const ev of events) {
      if (ev.type !== "message" || !isTextMessage(ev.message)) {
        results.push({ skipped: true, reason: "not_text_message" });
        continue;
      }

      const userId =
        ev.source?.userId || ev.source?.groupId || ev.source?.roomId || "unknown";
      const text = ev.message.text || "";
      const kind = classify(text);

      // Anti-duplicate: เคสซ้ำใน 15 นาที
      const dupe = await prisma.caseItem.findFirst({
        where: {
          botId,
          userId,
          kind,
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (dupe) {
        results.push({
          ok: true,
          duplicateWithin15m: true,
          caseId: dupe.id,
          replied: false,
        });
        continue;
      }

      // --- สร้างเคสใหม่ ---
      const created = await prisma.caseItem.create({
        data: { botId, userId, text, kind },
        select: { id: true, createdAt: true },
      });

      // ---------- Update StatDaily (safe) ----------
      const dateKey = new Date().toISOString().slice(0, 10);
      try {
        await prisma.statDaily.upsert({
          where: { botId_dateKey: { botId, dateKey } },
          update: { total: { increment: 1 }, text: { increment: 1 } },
          create: { botId, dateKey, total: 1, text: 1, follow: 0, unfollow: 0 },
        });
      } catch {
        // fallback แม้ schema/unique ยังไม่พร้อม
        const existed = await prisma.statDaily.findFirst({ where: { botId, dateKey } });
        if (existed) {
          await prisma.statDaily.update({
            where: { id: existed.id },
            data: { total: { increment: 1 }, text: { increment: 1 } },
          });
        } else {
          await prisma.statDaily.create({
            data: { botId, dateKey, total: 1, text: 1, follow: 0, unfollow: 0 },
          });
        }
      }

      // (ถ้ามีระบบ Broadcast SSE ในโปรเจกต์ สามารถยิง event ได้ที่นี่)
      // ตัวอย่างแบบไม่บังคับ: 
      // try { (req.app as any)?.locals?.broadcast?.({ type:"case:new", tenant, botId, at:new Date().toISOString(), data:{ caseId: created.id } }); } catch {}

      let replySent = false;

      // ตอบเฉพาะครั้งแรก และต้องมี replyToken + accessToken จริง
      if (!isRetry && ev.replyToken && channelAccessToken) {
        try {
          let answer = "ขออภัยค่ะ พี่พลอยติดขัดนิดหน่อย ลองพิมพ์อีกครั้งได้ไหมคะ";
          if (openaiApiKey) {
            try {
              answer = await askPloy({
                openaiKey: openaiApiKey,
                systemPrompt: systemPrompt || defaultSystemPrompt,
                userText: text,
              });
            } catch (aiErr) {
              console.error("[AI error]", aiErr);
            }
          } else {
            if (kind === "deposit")
              answer = "รับเรื่องฝากไม่เข้าแล้วครับ กำลังตรวจสอบให้นะครับ 🙏";
            else if (kind === "withdraw")
              answer = "รับเรื่องถอนแล้วครับ กำลังตรวจสอบให้นะครับ 🙏";
            else if (kind === "kyc")
              answer = "รับเรื่องยืนยันตัวตนแล้วครับ กำลังตรวจสอบให้นะครับ 🙏";
            else answer = "รับข้อความแล้วครับ แอดมินกำลังตรวจสอบให้นะครับ 🙏";
          }

          replySent = await lineReply(ev.replyToken, channelAccessToken, answer).catch(
            () => false
          );
        } catch {
          replySent = false;
        }
      }

      results.push({ ok: true, caseId: created.id, replied: replySent });
    }

    return res.status(200).json({ ok: true, results, retry: isRetry });
  } catch (e) {
    console.error("[LINE WEBHOOK ERROR]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default router;
