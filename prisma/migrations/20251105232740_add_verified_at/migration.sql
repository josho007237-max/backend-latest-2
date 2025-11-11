-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'line',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" DATETIME
);
INSERT INTO "new_Bot" ("createdAt", "id", "isActive", "name", "provider", "tenant", "updatedAt") SELECT "createdAt", "id", "isActive", "name", "provider", "tenant", "updatedAt" FROM "Bot";
DROP TABLE "Bot";
ALTER TABLE "new_Bot" RENAME TO "Bot";
CREATE UNIQUE INDEX "Bot_tenant_name_key" ON "Bot"("tenant", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
