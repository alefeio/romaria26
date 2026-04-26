ALTER TABLE "ReservationVoucher"
  ADD COLUMN IF NOT EXISTS "packageId" TEXT,
  ADD COLUMN IF NOT EXISTS "codeNumber" INTEGER;

-- preencher snapshot de packageId a partir da reserva
UPDATE "ReservationVoucher" v
SET "packageId" = r."packageId"
FROM "Reservation" r
WHERE v."reservationId" = r."id" AND v."packageId" IS NULL;

-- Para instalações antigas (código aleatório), não é possível derivar codeNumber.
-- A partir desta migração, novos vouchers serão gerados com codeNumber e code no formato numérico.

-- Tornar colunas obrigatórias para novos registros (mantém compatibilidade se já houver dados legados sem codeNumber).
ALTER TABLE "ReservationVoucher"
  ALTER COLUMN "packageId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ReservationVoucher_packageId_idx" ON "ReservationVoucher" ("packageId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReservationVoucher_package_codeNumber_unique" ON "ReservationVoucher" ("packageId", "codeNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ReservationVoucher_code_key" ON "ReservationVoucher" ("code");

