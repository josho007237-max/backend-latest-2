-- CreateTable
CREATE TABLE "AiPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "topP" REAL DEFAULT 1,
    "maxTokens" INTEGER DEFAULT 800,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "toolsJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeDoc" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tags" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BotKnowledge" (
    "botId" TEXT NOT NULL,
    "docId" TEXT NOT NULL,

    PRIMARY KEY ("botId", "docId"),
    CONSTRAINT "BotKnowledge_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BotKnowledge_docId_fkey" FOREIGN KEY ("docId") REFERENCES "KnowledgeDoc" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "presetId" TEXT,
    "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "topP" REAL DEFAULT 1,
    "maxTokens" INTEGER DEFAULT 800,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotConfig_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "AiPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BotConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BotConfig" ("botId", "id", "maxTokens", "openaiModel", "systemPrompt", "temperature", "topP", "updatedAt") SELECT "botId", "id", "maxTokens", "openaiModel", "systemPrompt", "temperature", "topP", "updatedAt" FROM "BotConfig";
DROP TABLE "BotConfig";
ALTER TABLE "new_BotConfig" RENAME TO "BotConfig";
CREATE UNIQUE INDEX "BotConfig_botId_key" ON "BotConfig"("botId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AiPreset_tenant_name_key" ON "AiPreset"("tenant", "name");
