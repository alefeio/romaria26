-- Colaboradores do evento: vouchers na faixa 3001-4000 (após crianças 2001-3000).

CREATE TABLE IF NOT EXISTS "EventCollaborator" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "roleLabel" TEXT,
  "shirtSize" TEXT,
  "notes" TEXT,
  "codeNumber" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "emailedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventCollaborator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventCollaborator_code_key" ON "EventCollaborator"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "EventCollaborator_packageId_codeNumber_key" ON "EventCollaborator"("packageId", "codeNumber");
CREATE INDEX IF NOT EXISTS "EventCollaborator_packageId_idx" ON "EventCollaborator"("packageId");
CREATE INDEX IF NOT EXISTS "EventCollaborator_voidedAt_idx" ON "EventCollaborator"("voidedAt");
CREATE INDEX IF NOT EXISTS "EventCollaborator_email_idx" ON "EventCollaborator"("email");

DO $$
BEGIN
  ALTER TABLE "EventCollaborator"
    ADD CONSTRAINT "EventCollaborator_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "VoucherCodeLedger" ADD COLUMN IF NOT EXISTS "collaboratorId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "VoucherCodeLedger_collaboratorId_key" ON "VoucherCodeLedger"("collaboratorId");

DO $$
BEGIN
  ALTER TABLE "VoucherCodeLedger"
    ADD CONSTRAINT "VoucherCodeLedger_collaboratorId_fkey"
    FOREIGN KEY ("collaboratorId") REFERENCES "EventCollaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
