-- Ajuste legado: ReservationInstallment.status era TEXT (20260421201000) mas o Prisma
-- espera o enum nativo "InstallmentStatus", o que gera: operator does not exist: text = "InstallmentStatus"
DO $create_enum$ BEGIN
  CREATE TYPE "InstallmentStatus" AS ENUM ('SCHEDULED', 'PAID', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $create_enum$;

DO $$
DECLARE
  col_udt name;
  tbl_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ReservationInstallment'
  ) INTO tbl_exists;

  IF NOT tbl_exists THEN
    RAISE NOTICE 'Tabela ReservationInstallment ausente, ignorando ajuste de status.';
    RETURN;
  END IF;

  SELECT c.udt_name
  INTO col_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'ReservationInstallment'
    AND c.column_name = 'status'
  LIMIT 1;

  IF col_udt IS NULL THEN
    RAISE NOTICE 'Coluna status não encontrada.';
    RETURN;
  END IF;

  -- Já está no enum correto
  IF col_udt = 'InstallmentStatus' THEN
    RETURN;
  END IF;

  -- TEXT / varchar -> enum
  IF col_udt IN ('text', 'varchar', 'bpchar') THEN
    ALTER TABLE "public"."ReservationInstallment" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "public"."ReservationInstallment"
      ALTER COLUMN "status" TYPE "InstallmentStatus"
      USING (
        CASE btrim("status"::text)
          WHEN 'SCHEDULED' THEN 'SCHEDULED'::"InstallmentStatus"
          WHEN 'PAID' THEN 'PAID'::"InstallmentStatus"
          WHEN 'CANCELED' THEN 'CANCELED'::"InstallmentStatus"
          ELSE 'SCHEDULED'::"InstallmentStatus"
        END
      );
    ALTER TABLE "public"."ReservationInstallment"
      ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::"InstallmentStatus";
  END IF;
END $$;
