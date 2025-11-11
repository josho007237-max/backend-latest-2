// src/scripts/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // === 1) Admin (upsert by email) ===========================================
  const email = process.env.ADMIN_EMAIL || "root@bn9.local";
  const plain = process.env.ADMIN_PASSWORD || "bn9@12345";
  const hash = await bcrypt.hash(plain, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { password: hash },
    create: { email, password: hash },
  });

  console.log("Seeded admin:", { email, password: plain, id: admin.id });

  // === 2) Bot (upsert by composite unique [tenant, name]) ====================
  const TENANT = process.env.TENANT_DEFAULT || "bn9";
  const NAME = "Dev Bot";

  const bot = await prisma.bot.upsert({
    // ใช้คีย์ผสม @@unique([tenant, name]) => where.tenant_name
    where: { tenant_name: { tenant: TENANT, name: NAME } },
    update: {},
    create: {
      tenant: TENANT,
      name: NAME,
      platform: "line",
      active: true,
    },
  });

  console.log("Upserted bot:", { id: bot.id, tenant: bot.tenant, name: bot.name });

  // === 3) BotConfig (upsert by botId: unique) ===============================
  await prisma.botConfig.upsert({
    where: { botId: bot.id },
    update: {},
    create: {
      botId: bot.id,
      // เปลี่ยนจาก openaiModel -> model ให้ตรง schema ใหม่
      model: "gpt-4o-mini",
      systemPrompt: "",
      temperature: 0.3,
      topP: 1,
      maxTokens: 800,
    },
  });

  // === 4) BotSecret (upsert by botId: unique) ===============================
  await prisma.botSecret.upsert({
    where: { botId: bot.id },
    update: {},
    create: {
      botId: bot.id,
      channelSecret: null,
      channelAccessToken: null,
      openaiApiKey: null,
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
