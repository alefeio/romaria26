ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "adultNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "childrenNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "childrenAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE TYPE "VoucherPersonType" AS ENUM ('ADULT', 'CHILD');

CREATE TABLE IF NOT EXISTS "ReservationVoucher" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "reservationId" TEXT NOT NULL,
  "personIndex" INTEGER NOT NULL,
  "personType" "VoucherPersonType" NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "age" INTEGER,
  "shirtSize" TEXT NOT NULL,
  "hasBreakfastKit" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "usedAt" TIMESTAMPTZ,
  CONSTRAINT "ReservationVoucher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReservationVoucher_code_key" ON "ReservationVoucher" ("code");
CREATE INDEX IF NOT EXISTS "ReservationVoucher_reservationId_idx" ON "ReservationVoucher" ("reservationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReservationVoucher_reservation_person_unique" ON "ReservationVoucher" ("reservationId", "personType", "personIndex");

ALTER TABLE "ReservationVoucher"
  ADD CONSTRAINT "ReservationVoucher_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

