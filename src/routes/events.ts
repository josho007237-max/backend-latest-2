import { Router } from "express";
import { sseHub } from "../lib/sseHub";
import { randomUUID } from "crypto";

export const events = Router();

events.get("/events", (req, res) => {
  const tenant = String(req.query.tenant || process.env.TENANT_DEFAULT || "bn9");
  const id = randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform"); // no transform สำคัญบน CF
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  sseHub.addClient(tenant, id, res);

  req.on("close", () => {
    sseHub.removeClient(tenant, id);
    try { res.end(); } catch {}
  });
});
