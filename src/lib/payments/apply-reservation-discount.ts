import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReservationDbClient } from "@/lib/payments/reservation-payments";
import { recalcReservationPaymentStatus } from "@/lib/payments/reservation-payments";
import { computeReservationTotalDue } from "@/lib/payments/reservation-discount";
import { releaseReservationVouchersIfPaid } from "@/lib/vouchers/voucher-release";

export async function applyReservationDiscount(
  tx: ReservationDbClient,
  reservationId: string,
  input: { amount: Prisma.Decimal; note: string | null }
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, totalPrice: true, discountAmount: true },
  });
  if (!reservation) return { err: "NOT_FOUND" as const };

  if (input.amount.lessThan(0)) {
    return { err: "INVALID_AMOUNT" as const, message: "O desconto não pode ser negativo." };
  }
  if (input.amount.greaterThan(reservation.totalPrice)) {
    return {
      err: "INVALID_AMOUNT" as const,
      message: "O desconto não pode ser maior que o subtotal da reserva.",
    };
  }

  const totalDue = computeReservationTotalDue(reservation.totalPrice, input.amount);

  await tx.reservation.update({
    where: { id: reservationId },
    data: {
      discountAmount: input.amount,
      discountNote: input.note?.trim() || null,
      totalDue,
    },
  });

  const pay = await recalcReservationPaymentStatus(tx, reservationId);
  await releaseReservationVouchersIfPaid(tx, reservationId);

  const updated = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      totalPrice: true,
      discountAmount: true,
      discountNote: true,
      totalDue: true,
      totalPaid: true,
      paymentStatus: true,
    },
  });

  return {
    ok: updated,
    previousDiscount: reservation.discountAmount,
    pay,
  };
}

export async function applyReservationDiscountById(
  reservationId: string,
  input: { amount: Prisma.Decimal; note: string | null }
) {
  return prisma.$transaction((tx) => applyReservationDiscount(tx, reservationId, input));
}
