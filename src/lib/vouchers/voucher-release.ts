import "server-only";

import type { ReservationDbClient } from "@/lib/payments/reservation-payments";

/** Marca vouchers pendentes como liberados quando a reserva está 100% paga. */
export async function releaseReservationVouchersIfPaid(tx: ReservationDbClient, reservationId: string) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: { paymentStatus: true },
  });
  if (!reservation || reservation.paymentStatus !== "PAID") return 0;

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
