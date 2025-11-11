// src/services/stats.ts
import { prisma } from "../lib/prisma";
import type { StatDaily } from "@prisma/client";

/** คืนค่า dateKey ของวันนี้ในรูปแบบ YYYY-MM-DD (UTC) */
export const todayKey = (): string => new Date().toISOString().slice(0, 10);

/** ดึงสถิติของวัน (ถ้าไม่ระบุ dateKey จะดึงของวันนี้) */
export async function findStatDaily(
  botId: string,
  dateKey?: string
): Promise<StatDaily | null> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();
  return prisma.statDaily.findUnique({
    where: { botId_dateKey: { botId, dateKey: key } },
  });
}

/** สร้างแถว StatDaily ใหม่ (ใช้ตอน seed/กรณีพิเศษ) */
export async function createStatDaily(
  botId: string,
  dateKey?: string,
  initial?: Partial<Pick<StatDaily, "total" | "text" | "follow" | "unfollow">>
): Promise<StatDaily> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();
  return prisma.statDaily.create({
    data: {
      bot: { connect: { id: botId } },
      dateKey: key,
      total: initial?.total ?? 0,
      text: initial?.text ?? 0,
      follow: initial?.follow ?? 0,
      unfollow: initial?.unfollow ?? 0,
    },
  });
}

/**
 * เพิ่มค่าตัวนับ (ถ้าไม่มีแถวจะสร้างใหม่)
 * @example
 * await incrementStatDaily(botId, undefined, { total: 1, text: 1 });
 */
export async function incrementStatDaily(
  botId: string,
  dateKey?: string,
  inc: Partial<Record<"total" | "text" | "follow" | "unfollow", number>> = {}
): Promise<StatDaily> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();

  const existing = await prisma.statDaily.findUnique({
    where: { botId_dateKey: { botId, dateKey: key } },
  });

  if (existing) {
    const data: {
      total?: { increment: number };
      text?: { increment: number };
      follow?: { increment: number };
      unfollow?: { increment: number };
    } = {};
    if (typeof inc.total === "number") data.total = { increment: inc.total };
    if (typeof inc.text === "number") data.text = { increment: inc.text };
    if (typeof inc.follow === "number") data.follow = { increment: inc.follow };
    if (typeof inc.unfollow === "number")
      data.unfollow = { increment: inc.unfollow };

    if (Object.keys(data).length === 0) return existing;
    return prisma.statDaily.update({ where: { id: existing.id }, data });
  }

  // ถ้ายังไม่มี แสดงว่าเป็นแถวใหม่ของวันนั้น
  return prisma.statDaily.create({
    data: {
      bot: { connect: { id: botId } },
      dateKey: key,
      total: inc.total ?? 0,
      text: inc.text ?? 0,
      follow: inc.follow ?? 0,
      unfollow: inc.unfollow ?? 0,
    },
  });
}

/**
 * อัปเซิร์ตด้วยค่าที่ "ตั้งค่าเป็น" (ไม่ใช่ increment)
 * มีไว้กรณีอยากเซ็ตค่าโดยตรง
 */
export async function upsertStatDaily(
  botId: string,
  dateKey?: string,
  setVals: Partial<Pick<StatDaily, "total" | "text" | "follow" | "unfollow">> = {}
): Promise<StatDaily> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();

  const existing = await prisma.statDaily.findUnique({
    where: { botId_dateKey: { botId, dateKey: key } },
  });

  if (existing) {
    return prisma.statDaily.update({
      where: { id: existing.id },
      data: { ...setVals },
    });
  }

  return prisma.statDaily.create({
    data: {
      bot: { connect: { id: botId } },
      dateKey: key,
      total: setVals.total ?? 0,
      text: setVals.text ?? 0,
      follow: setVals.follow ?? 0,
      unfollow: setVals.unfollow ?? 0,
    },
  });
}

/** ดึงสถิติช่วงวัน [from, to] รวมปลายทาง เรียงจากเก่า → ใหม่ */
export async function getStatRange(
  botId: string,
  from: string,
  to: string
): Promise<StatDaily[]> {
  if (!botId) throw new Error("missing botId");
  return prisma.statDaily.findMany({
    where: { botId, dateKey: { gte: from, lte: to } },
    orderBy: { dateKey: "asc" },
  });
}

/**
 * Helper เพิ่มตามชนิดอีเวนต์:
 * - "text": total+1, text+1
 * - "follow": total+1, follow+1
 * - "unfollow": total+1, unfollow+1
 * - อื่นๆ: total+1
 */
export async function addEventStat(
  botId: string,
  kind: "text" | "follow" | "unfollow" | "other" = "other",
  dateKey?: string
): Promise<StatDaily> {
  const inc: Partial<Record<"total" | "text" | "follow" | "unfollow", number>> =
    { total: 1 };
  if (kind === "text") inc.text = 1;
  else if (kind === "follow") inc.follow = 1;
  else if (kind === "unfollow") inc.unfollow = 1;

  return incrementStatDaily(botId, dateKey, inc);
}

/** สร้างแถวของวันนี้ถ้ายังไม่มี แล้วคืนค่า */
export async function ensureTodayStat(botId: string): Promise<StatDaily> {
  const key = todayKey();
  const existing = await findStatDaily(botId, key);
  if (existing) return existing;
  return createStatDaily(botId, key, { total: 0, text: 0, follow: 0, unfollow: 0 });
}
