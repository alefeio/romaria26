-- Create share table for voucher temporary access
CREATE TABLE IF NOT EXISTS "ReservationVoucherShare" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "voucherId" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT,
  CONSTRAINT "ReservationVoucherShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReservationVoucherShare_voucherId_createdAt_idx"
  ON "ReservationVoucherShare" ("voucherId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReservationVoucherShare_expiresAt_idx"
  ON "ReservationVoucherShare" ("expiresAt");

ALTER TABLE "ReservationVoucherShare"
  ADD CONSTRAINT "ReservationVoucherShare_voucherId_fkey"
  FOREIGN KEY ("voucherId") REFERENCES "ReservationVoucher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

