import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { ReservationDbClient } from "@/lib/payments/reservation-payments";

/** Marca vouchers pendentes como liberados quando a reserva está quitada (ou totalDue = 0). */
export async function releaseReservationVouchersIfPaid(tx: ReservationDbClient, reservationId: string) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: { paymentStatus: true, totalDue: true },
  });
  if (!reservation) return 0;

  const due = reservation.totalDue ?? new Prisma.Decimal(0);
  const settledByZeroDue = due.lessThanOrEqualTo(0);
  if (reservation.paymentStatus !== "PAID" && !settledByZeroDue) return 0;

  if (reservation.paymentStatus !== "PAID" && settledByZeroDue) {
    await tx.reservation.update({
      where: { id: reservationId },
      data: { paymentStatus: "PAID" },
    });
  }

  const now = new Date();
  const result = await tx.reservationVoucher.updateMany({
    where: { reservationId, releasedAt: null },
    data: { releasedAt: now },
  });
  return result.count;
}

export function isVoucherReleasedForUse(voucher: { releasedAt: Date | null; usedAt: Date | null }): boolean {
  return Boolean(voucher.releasedAt) && !voucher.usedAt;
}
