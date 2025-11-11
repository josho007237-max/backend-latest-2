/*
  Warnings:

  - You are about to drop the column `message` on the `CaseItem` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `CaseItem` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `CaseItem` table. All the data in the column will be lost.
  - You are about to drop the column `cases` on the `StatDaily` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `StatDaily` table. All the data in the column will be lost.
  - You are about to drop the column `events` on the `StatDaily` table. All the data in the column will be lost.
  - Added the required column `kind` to the `CaseItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `text` to the `CaseItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateKey` to the `StatDaily` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StatDaily` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "userId" TEXT,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseItem_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CaseItem" ("botId", "createdAt", "id", "userId") SELECT "botId", "createdAt", "id", "userId" FROM "CaseItem";
DROP TABLE "CaseItem";
ALTER TABLE "new_CaseItem" RENAME TO "CaseItem";
CREATE INDEX "CaseItem_botId_createdAt_idx" ON "CaseItem"("botId", "createdAt");
CREATE TABLE "new_StatDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "text" INTEGER NOT NULL DEFAULT 0,
    "follow" INTEGER NOT NULL DEFAULT 0,
    "unfollow" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StatDaily_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StatDaily" ("botId", "id") SELECT "botId", "id" FROM "StatDaily";
DROP TABLE "StatDaily";
ALTER TABLE "new_StatDaily" RENAME TO "StatDaily";
CREATE UNIQUE INDEX "StatDaily_botId_dateKey_key" ON "StatDaily"("botId", "dateKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
