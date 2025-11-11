// src/lib/api.ts
import axios from "axios";

export const API = axios.create({ baseURL: "" });
// ถ้าต้องการยิงออกภายนอก ให้เซ็ต baseURL จาก ENV เอาเอง เช่น:
// export const API = axios.create({ baseURL: process.env.OUTBOUND_BASE || "" });

export type BotConfig = {
  openaiModel: string;
  systemPrompt: string;
  temperature: number;
  topP?: number;
  maxTokens?: number;
};
export async function getBotConfig(botId: string) {
  const r = await API.get<{ ok: boolean; config: BotConfig; allowedModels: string[] }>(`/api/admin/bots/${botId}/config`);
  return r.data;
}
export async function updateBotConfig(botId: string, cfg: Partial<BotConfig>) {
  const r = await API.put<{ ok: boolean; config: BotConfig; allowedModels: string[] }>(`/api/admin/bots/${botId}/config`, cfg);
  return r.data;
}

