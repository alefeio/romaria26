ALTER TABLE "ReservationVoucher" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);

-- Vouchers já existentes: considerados liberados na data de criação.
UPDATE "ReservationVoucher"
SET "releasedAt" = "createdAt"
WHERE "releasedAt" IS NULL;
