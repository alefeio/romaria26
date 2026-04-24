import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient, ReservationPaymentStatus } from "@/generated/prisma/client";

/** Cliente Prisma dentro de `$transaction` (sem métodos de infraestrutura). */
export type ReservationDbClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export async function recalcReservationPaymentStatus(tx: ReservationDbClient, reservationId: string) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      totalDue: true,
      paymentStatus: true,
    },
  });
  if (!reservation) return null;

  const agg = await tx.reservationPayment.aggregate({
    where: { reservationId },
    _sum: { amount: true },
  });
  const paid = agg._sum.amount ?? new Prisma.Decimal(0);
  const due = reservation.totalDue ?? new Prisma.Decimal(0);

  let status: ReservationPaymentStatus = "UNPAID";
  if (paid.greaterThanOrEqualTo(due) && due.greaterThan(0)) status = "PAID";
  else if (paid.greaterThan(0) && paid.lessThan(due)) status = "PARTIAL";
  else status = "UNPAID";

  const updated = await tx.reservation.update({
    where: { id: reservationId },
    data: {
      totalPaid: paid,
      paymentStatus: status,
    },
    select: { id: true, totalPaid: true, paymentStatus: true },
  });
  return updated;
}

