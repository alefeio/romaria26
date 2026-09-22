-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SELLER';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "soldByUserId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "soldAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Reservation_soldByUserId_idx" ON "Reservation"("soldByUserId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
