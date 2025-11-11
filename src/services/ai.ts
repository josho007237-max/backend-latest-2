// src/services/ai.ts
export type AskOptions = {
  model: string;
  systemPrompt: string;
  userText: string;
  openaiKey: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
};

export async function askPloy({
  model,
  systemPrompt,
  userText,
  openaiKey,
  temperature = 0.3,
  top_p = 0.9,
  max_tokens = 600,
}: AskOptions): Promise<string> {
  if (!openaiKey) {
    return "ตอนนี้ยังไม่ได้ตั้งค่า OpenAI API Key ค่ะ แอดมินลองเช็คหน้า Bots → Secrets นะคะ 💛";
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      top_p,
      max_tokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("OpenAI error:", res.status, txt);
    return "ขอโทษค่ะ ระบบ AI มีปัญหาชั่วคราว ลองใหม่อีกครั้งนะคะ 🙏";
    }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim()
    || "ขอโทษค่ะ ยังไม่ได้ข้อความตอบกลับจาก AI ค่ะ";
}
