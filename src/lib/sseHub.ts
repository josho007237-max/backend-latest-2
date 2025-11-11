import type { Request, Response } from "express";

type Tenant = string;
type Client = { id: string; res: Response; tenant: Tenant; alive: boolean };

export type EventPayload =
  | { type: "hello"; tenant: Tenant }
  | { type: "ping"; tenant: Tenant }
  | { type: "case:new"; tenant: Tenant; botId: string; caseId: string; at: string }
  | { type: "stats:update"; tenant: Tenant; botId: string; at: string; data?: any }
  | { type: "bot:verified"; tenant: Tenant; botId: string; at: string };

class SseHub {
  private clients = new Map<Tenant, Map<string, Client>>();
  private pingTimer?: NodeJS.Timeout;

  addClient(tenant: Tenant, id: string, res: Response) {
    if (!this.clients.has(tenant)) this.clients.set(tenant, new Map());
    const bucket = this.clients.get(tenant)!;
    bucket.set(id, { id, res, tenant, alive: true });

    // ส่ง hello ทันที
    this.send(res, "hello", { type: "hello", tenant });

    // ตั้ง heartbeat รวมศูนย์ครั้งเดียว
    if (!this.pingTimer) {
      this.pingTimer = setInterval(() => this.heartbeat(), 25_000);
    }
  }

  removeClient(tenant: Tenant, id: string) {
    const bucket = this.clients.get(tenant);
    if (!bucket) return;
    bucket.delete(id);
    if (bucket.size === 0) this.clients.delete(tenant);
    if (this.size() === 0 && this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private send(res: Response, event: string, data: any) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private heartbeat() {
    for (const [tenant, bucket] of this.clients) {
      for (const [, client] of bucket) {
        try { this.send(client.res, "ping", { type: "ping", tenant }); }
        catch { /* noop */ }
      }
    }
  }

  broadcast(evt: EventPayload) {
    const bucket = this.clients.get(evt.tenant);
    if (!bucket || bucket.size === 0) return;
    const eventName = evt.type; // ชื่อ event == type
    for (const [, client] of bucket) this.send(client.res, eventName, evt);
  }

  private size() {
    let n = 0;
    for (const [, bucket] of this.clients) n += bucket.size;
    return n;
  }
}

export const sseHub = new SseHub();
