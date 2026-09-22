-- A coluna paymentStatus foi criada como TEXT e a migração seguinte
-- usou ADD COLUMN IF NOT EXISTS (não converteu o tipo). O Prisma 7
-- compara o enum ReservationPaymentStatus e o Postgres recusa `text <> enum`.

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Reservation'
      AND column_name = 'paymentStatus'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "Reservation" ALTER COLUMN "paymentStatus" DROP DEFAULT;
    ALTER TABLE "Reservation"
      ALTER COLUMN "paymentStatus" TYPE "ReservationPaymentStatus"
      USING "paymentStatus"::"ReservationPaymentStatus";
    ALTER TABLE "Reservation"
      ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID'::"ReservationPaymentStatus";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReservationPayment'
      AND column_name = 'method'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "ReservationPayment"
      ALTER COLUMN "method" TYPE "PaymentMethod"
      USING "method"::"PaymentMethod";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReservationInstallment'
      AND column_name = 'status'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "ReservationInstallment" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "ReservationInstallment"
      ALTER COLUMN "status" TYPE "InstallmentStatus"
      USING "status"::"InstallmentStatus";
    ALTER TABLE "ReservationInstallment"
      ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::"InstallmentStatus";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReservationInstallment'
      AND column_name = 'method'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "ReservationInstallment"
      ALTER COLUMN "method" TYPE "PaymentMethod"
      USING "method"::"PaymentMethod";
  END IF;
END $$;
