// src/services/stats.ts
import { prisma } from "../lib/prisma";
import type { StatDaily } from "@prisma/client";

const todayKey = () => new Date().toISOString().slice(0, 10);

export async function findStatDaily(botId: string, dateKey?: string): Promise<StatDaily | null> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();
  return prisma.statDaily.findUnique({ where: { botId_dateKey: { botId, dateKey: key } } });
}

export async function createStatDaily(
  botId: string,
  dateKey?: string,
  initial?: Partial<Pick<StatDaily, "total" | "text" | "follow" | "unfollow">>
) {
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

export async function incrementStatDaily(
  botId: string,
  dateKey?: string,
  inc: Partial<Record<"total" | "text" | "follow" | "unfollow", number>> = {}
) {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();

  const existing = await prisma.statDaily.findUnique({ where: { botId_dateKey: { botId, dateKey: key } } });
  if (existing) {
    const data: any = {};
    if (typeof inc.total === "number") data.total = { increment: inc.total };
    if (typeof inc.text === "number") data.text = { increment: inc.text };
    if (typeof inc.follow === "number") data.follow = { increment: inc.follow };
    if (typeof inc.unfollow === "number") data.unfollow = { increment: inc.unfollow };

    if (Object.keys(data).length === 0) return existing;
    return prisma.statDaily.update({ where: { id: existing.id }, data });
  } else {
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
}
