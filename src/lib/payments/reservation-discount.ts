import { Prisma } from "@/generated/prisma/client";

export function computeReservationTotalDue(
  totalPrice: Prisma.Decimal,
  discountAmount: Prisma.Decimal
): Prisma.Decimal {
  const due = totalPrice.sub(discountAmount);
  return due.lessThan(0) ? new Prisma.Decimal(0) : due;
}
