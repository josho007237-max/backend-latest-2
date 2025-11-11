// src/services/aiConfig.ts
import { prisma } from "../lib/prisma";

export type AiConfig = {
  openaiModel: string;
  systemPrompt: string;
  temperature: number;
  topP: number | null;
  maxTokens: number | null;
};

export async function readBotConfig(botId: string): Promise<AiConfig> {
  const cfg = await prisma.botConfig.findUnique({ where: { botId } });
  return {
    openaiModel: cfg?.openaiModel ?? "gpt-4o-mini",
    systemPrompt: cfg?.systemPrompt ?? "",
    temperature: cfg?.temperature ?? 0.3,
    topP: cfg?.topP ?? 1,
    maxTokens: cfg?.maxTokens ?? 800,
  };
}

export async function updateBotConfig(botId: string, patch: Partial<AiConfig>) {
  const exists = await prisma.botConfig.findUnique({ where: { botId } });
  if (!exists) {
    return prisma.botConfig.create({
      data: {
        botId,
        openaiModel: patch.openaiModel ?? "gpt-4o-mini",
        systemPrompt: patch.systemPrompt ?? "",
        temperature: patch.temperature ?? 0.3,
        topP: patch.topP ?? 1,
        maxTokens: patch.maxTokens ?? 800,
      },
    });
  }
  return prisma.botConfig.update({ where: { botId }, data: patch });
}
