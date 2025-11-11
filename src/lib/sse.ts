// src/lib/sse.ts
import type { Request, Response } from "express";

type Tenant = string;
type SSEClient = Response;

// เก็บ client ต่อ tenant
const channels = new Map<Tenant, Set<SSEClient>>();

/** แนบ SSE กับ response (GET /api/events?tenant=xxx) */
export function attachSSE(req: Request, res: Response) {
  const tenant = String(req.query.tenant ?? "").trim();
  if (!tenant) {
    res.status(400).end("tenant required");
    return;
  }

  // Headers ที่จำเป็นสำหรับ SSE
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // กัน nginx buffer
  (res as any).flushHeaders?.();

  // กันการ timeout ของ socket ฝั่ง Node
  (req.socket as any)?.setTimeout?.(0);

  // ลงทะเบียน client
  let set = channels.get(tenant);
  if (!set) {
    set = new Set<SSEClient>();
    channels.set(tenant, set);
  }
  set.add(res);

  // แนะนำตัว + ค่า retry ให้ client
  res.write(`retry: 15000\n`);
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, tenant })}\n\n`);

  // heartbeat ทุก 15s
  const hb = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {
      // ถ้าเขียนไม่ได้ เดี๋ยว close handler จะเก็บกวาดให้
    }
  }, 15000);

  // cleanup เมื่อ client ปิดการเชื่อมต่อ
  req.on("close", () => {
    clearInterval(hb);
    channels.get(tenant)?.delete(res);
    if ((channels.get(tenant)?.size ?? 0) === 0) channels.delete(tenant);
  });
}

/** ส่ง event ถึงทุก client ใน tenant นั้นๆ */
export function broadcast(tenant: string, type: string, payload: unknown) {
  const set = channels.get(tenant);
  if (!set || set.size === 0) return;

  const data = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      // ถ้าเขียนไม่ได้ ถือว่า socket ตายแล้ว — ลบทิ้ง
      set.delete(res);
    }
  }
}

/** ใช้ debug นับจำนวน subscriber ของ tenant */
export function subscribers(tenant: string): number {
  return channels.get(tenant)?.size ?? 0;
}
