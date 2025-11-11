// src/lib/line.ts
import crypto from "node:crypto";

/** ตรวจลายเซ็นของ LINE (rawBody ต้องเป็น Buffer) */
export function verifyLineSignature(rawBody: Buffer, secret: string, headerSig?: string) {
  if (!secret) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("base64");
  return expected === headerSig;
}

export type LineReplyMessage = { type: "text"; text: string };

/** เรียก LINE Reply API ด้วย global fetch (Node 18+) */
export async function lineReply(
  replyToken: string,
  messages: LineReplyMessage[],
  channelAccessToken: string
) {
  const url = "https://api.line.me/v2/bot/message/reply";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`line_reply_failed: ${res.status} ${text}`);
  }
}
