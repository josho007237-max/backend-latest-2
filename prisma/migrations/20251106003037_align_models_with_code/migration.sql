/*
  Warnings:

  - You are about to drop the column `isActive` on the `Bot` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Bot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BotSecret" ADD COLUMN "openaiApiKey" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'line',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Bot" ("active", "createdAt", "id", "name", "platform", "tenant", "updatedAt", "verifiedAt") SELECT "active", "createdAt", "id", "name", "platform", "tenant", "updatedAt", "verifiedAt" FROM "Bot";
DROP TABLE "Bot";
ALTER TABLE "new_Bot" RENAME TO "Bot";
CREATE UNIQUE INDEX "Bot_tenant_name_key" ON "Bot"("tenant", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
