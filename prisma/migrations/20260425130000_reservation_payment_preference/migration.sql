ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "paymentPreferenceMethod" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "paymentPreferenceInstallments" INTEGER;

