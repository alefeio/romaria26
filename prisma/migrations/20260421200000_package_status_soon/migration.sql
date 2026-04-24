DO $$
BEGIN
  -- Prisma enum: PackageStatus
  ALTER TYPE "PackageStatus" ADD VALUE IF NOT EXISTS 'SOON';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

