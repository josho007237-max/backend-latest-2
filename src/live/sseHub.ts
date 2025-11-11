// src/live/sseHub.ts
import { Response } from "express";
type Client = { id: string; tenant: string; res: Response };

class SseHub {
  private readonly clients = new Map<string, Client>(); // readonly ตามคำแนะนำ

  add(c: Client) { this.clients.set(c.id, c); }
  remove(id: string) { this.clients.delete(id); }

  broadcast(tenant: string, event: any) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of this.clients.values()) {
      if (c.tenant === tenant) {
        try { c.res.write(data); } catch {}
      }
    }
  }
}
export const sseHub = new SseHub();
