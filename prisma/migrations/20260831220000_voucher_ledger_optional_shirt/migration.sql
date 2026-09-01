-- Ledger permanente de números de voucher (nunca reutiliza após cancelamento/exclusão).
CREATE TABLE IF NOT EXISTS "VoucherCodeLedger" (
  "id" TEXT NOT NULL,
  "codeNumber" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "rangeFrom" INTEGER NOT NULL,
  "rangeTo" INTEGER NOT NULL,
  "voucherId" TEXT,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoucherCodeLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoucherCodeLedger_codeNumber_key" ON "VoucherCodeLedger"("codeNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "VoucherCodeLedger_code_key" ON "VoucherCodeLedger"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "VoucherCodeLedger_voucherId_key" ON "VoucherCodeLedger"("voucherId");

DO $$
BEGIN
  ALTER TABLE "VoucherCodeLedger"
    ADD CONSTRAINT "VoucherCodeLedger_voucherId_fkey"
    FOREIGN KEY ("voucherId") REFERENCES "ReservationVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "VoucherCodeLedger" ("id", "codeNumber", "code", "rangeFrom", "rangeTo", "voucherId", "allocatedAt")
SELECT
  gen_random_uuid()::text,
  rv."codeNumber",
  rv."code",
  CASE
    WHEN rv."codeNumber" BETWEEN 1 AND 1000 THEN 1
    WHEN rv."codeNumber" BETWEEN 1001 AND 2000 THEN 1001
    WHEN rv."codeNumber" BETWEEN 2001 AND 3000 THEN 2001
    ELSE 1
  END,
  CASE
    WHEN rv."codeNumber" BETWEEN 1 AND 1000 THEN 1000
    WHEN rv."codeNumber" BETWEEN 1001 AND 2000 THEN 2000
    WHEN rv."codeNumber" BETWEEN 2001 AND 3000 THEN 3000
    ELSE 3000
  END,
  rv."id",
  rv."createdAt"
FROM "ReservationVoucher" rv
WHERE rv."codeNumber" IS NOT NULL
ON CONFLICT ("codeNumber") DO NOTHING;

ALTER TABLE "ReservationVoucher" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "ReservationVoucher" ADD COLUMN IF NOT EXISTS "hasOptionalPaidShirt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReservationVoucher" ADD COLUMN IF NOT EXISTS "optionalShirtPrice" DECIMAL(12,2);

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "childrenOptionalShirtIncluded" BOOLEAN[] NOT NULL DEFAULT ARRAY[]::BOOLEAN[];
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "childrenOptionalShirtPrices" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[];
