-- Reservation payment aggregates/status
ALTER TABLE "Reservation"
  ADD COLUMN "amountAdultSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amountChildSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID';

-- Enums (as TEXT columns via Prisma; keep as TEXT for compatibility)
-- Payments table
CREATE TABLE "ReservationPayment" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method" TEXT NOT NULL,
  "note" TEXT,
  "receiptUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationPayment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReservationPayment_reservationId_idx" ON "ReservationPayment"("reservationId");
CREATE INDEX "ReservationPayment_paidAt_idx" ON "ReservationPayment"("paidAt");

-- Installments table
CREATE TABLE "ReservationInstallment" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "dueDate" DATE NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "paidAt" TIMESTAMP(3),
  "method" TEXT,
  "note" TEXT,
  "receiptUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationInstallment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReservationInstallment_reservationId_idx" ON "ReservationInstallment"("reservationId");
CREATE INDEX "ReservationInstallment_dueDate_status_idx" ON "ReservationInstallment"("dueDate","status");

