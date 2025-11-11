// src/lib/prisma.ts
/**
 * Prisma client singleton helper
 *
 * - Export แบบ named `prisma` (ใช้ import { prisma } from "../lib/prisma")
 * - ตั้ง logging แบบพื้นฐาน (ปรับได้ด้วย env)
 * - จับ signal/event เพื่อ disconnect ตอนโปรเซสปิด
 */

import { PrismaClient } from "@prisma/client";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Enable some Prisma logs while developing.
 * In production you may want to reduce this.
 */
const prisma = new PrismaClient({
  log: isDev ? ["info", "warn", "error"] : ["warn", "error"],
  // 조회/설정อื่นๆที่ต้องการใส่ตรงนี้ได้
});

/**
 * Optional: try to connect early so runtime errors surface on boot.
 * If you prefer lazy connect, comment out the block below.
 */
if (isDev) {
  prisma
    .$connect()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("[prisma] connected");
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[prisma] connect error:", err);
    });
}

/**
 * Graceful shutdown: ensure Prisma disconnects on process exit.
 * This prevents leaking DB connections in some hosting environments.
 */
let _prismaDisconnectRegistered = false;

function registerShutdown() {
  if (_prismaDisconnectRegistered) return;
  _prismaDisconnectRegistered = true;

  const shutdown = async (signal?: string) => {
    try {
      // eslint-disable-next-line no-console
      console.log(`[prisma] disconnecting...${signal ? " (" + signal + ")" : ""}`);
      await prisma.$disconnect();
      // eslint-disable-next-line no-console
      console.log("[prisma] disconnected");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[prisma] disconnect error:", e);
    } finally {
      // in some environments we want to exit explicitly
      if (signal) process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("beforeExit", () => shutdown("beforeExit"));
  process.on("exit", () => {
    // best-effort; $disconnect is async so we only log here
    // eslint-disable-next-line no-console
    console.log("[prisma] process.exit");
  });
}

registerShutdown();

export { prisma };
export default prisma;
