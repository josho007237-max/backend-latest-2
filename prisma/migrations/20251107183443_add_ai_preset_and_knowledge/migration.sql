/*
  Warnings:

  - The primary key for the `BotKnowledge` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotKnowledge" (
    "botId" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotKnowledge_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BotKnowledge_docId_fkey" FOREIGN KEY ("docId") REFERENCES "KnowledgeDoc" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BotKnowledge" ("botId", "docId") SELECT "botId", "docId" FROM "BotKnowledge";
DROP TABLE "BotKnowledge";
ALTER TABLE "new_BotKnowledge" RENAME TO "BotKnowledge";
CREATE UNIQUE INDEX "BotKnowledge_botId_docId_key" ON "BotKnowledge"("botId", "docId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
