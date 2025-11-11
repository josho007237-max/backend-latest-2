-- CreateTable
CREATE TABLE "BotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "topP" REAL DEFAULT 1,
    "maxTokens" INTEGER DEFAULT 800,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BotConfig_botId_key" ON "BotConfig"("botId");
