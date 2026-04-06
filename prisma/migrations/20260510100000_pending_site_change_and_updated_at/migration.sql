-- Tabela alinhada ao schema (antes só existia via db push / manual)
CREATE TABLE "PendingSiteChange" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingSiteChange_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PendingSiteChange" ADD CONSTRAINT "PendingSiteChange_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingSiteChange" ADD CONSTRAINT "PendingSiteChange_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- @updatedAt: sem DEFAULT na BD (Prisma gere no cliente)
ALTER TABLE "Package" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TabletBanner" ALTER COLUMN "updatedAt" DROP DEFAULT;
