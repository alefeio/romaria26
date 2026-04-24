DO $$
BEGIN
  CREATE TYPE "ReservationPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InstallmentStatus" AS ENUM ('SCHEDULED', 'PAID', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "amountAdultSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "amountChildSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentStatus" "ReservationPaymentStatus" NOT NULL DEFAULT 'UNPAID';

CREATE TABLE IF NOT EXISTS "ReservationPayment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reservationId" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method" "PaymentMethod" NOT NULL,
  "note" TEXT,
  "receiptUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ReservationPayment_reservationId_idx" ON "ReservationPayment" ("reservationId");
CREATE INDEX IF NOT EXISTS "ReservationPayment_paidAt_idx" ON "ReservationPayment" ("paidAt");

DO $$
BEGIN
  ALTER TABLE "ReservationPayment"
    ADD CONSTRAINT "ReservationPayment_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReservationInstallment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reservationId" UUID NOT NULL,
  "dueDate" DATE NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "InstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "paidAt" TIMESTAMP(3),
  "method" "PaymentMethod",
  "note" TEXT,
  "receiptUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ReservationInstallment_reservationId_idx" ON "ReservationInstallment" ("reservationId");
CREATE INDEX IF NOT EXISTS "ReservationInstallment_dueDate_status_idx" ON "ReservationInstallment" ("dueDate", "status");

DO $$
BEGIN
  ALTER TABLE "ReservationInstallment"
    ADD CONSTRAINT "ReservationInstallment_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

