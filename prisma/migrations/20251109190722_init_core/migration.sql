/*
  Warnings:

  - You are about to drop the column `openaiModel` on the `BotConfig` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "topP" REAL NOT NULL DEFAULT 1,
    "maxTokens" INTEGER NOT NULL DEFAULT 800,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "toolsJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AiPreset" ("createdAt", "id", "maxTokens", "model", "name", "systemPrompt", "temperature", "tenant", "toolsJson", "topP", "updatedAt") SELECT "createdAt", "id", coalesce("maxTokens", 800) AS "maxTokens", "model", "name", "systemPrompt", "temperature", "tenant", "toolsJson", coalesce("topP", 1) AS "topP", "updatedAt" FROM "AiPreset";
DROP TABLE "AiPreset";
ALTER TABLE "new_AiPreset" RENAME TO "AiPreset";
CREATE UNIQUE INDEX "AiPreset_tenant_name_key" ON "AiPreset"("tenant", "name");
CREATE TABLE "new_BotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "presetId" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "topP" REAL NOT NULL DEFAULT 1,
    "maxTokens" INTEGER NOT NULL DEFAULT 800,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotConfig_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "AiPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BotConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BotConfig" ("botId", "id", "maxTokens", "presetId", "systemPrompt", "temperature", "topP", "updatedAt") SELECT "botId", "id", coalesce("maxTokens", 800) AS "maxTokens", "presetId", "systemPrompt", "temperature", coalesce("topP", 1) AS "topP", "updatedAt" FROM "BotConfig";
DROP TABLE "BotConfig";
ALTER TABLE "new_BotConfig" RENAME TO "BotConfig";
CREATE UNIQUE INDEX "BotConfig_botId_key" ON "BotConfig"("botId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
