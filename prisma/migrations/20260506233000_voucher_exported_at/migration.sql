-- Add export tracking to vouchers
ALTER TABLE "ReservationVoucher"
ADD COLUMN IF NOT EXISTS "exportedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "exportedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "ReservationVoucher_exportedAt_idx" ON "ReservationVoucher" ("exportedAt");

