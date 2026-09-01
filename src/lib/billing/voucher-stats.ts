import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type BillingVoucherStats = {
  total: number;
  adults: number;
  paidChildren: number;
  unpaidChildren: number;
  kits: number;
  optionalShirts: number;
  optionalShirtsAmount: string;
};

export const EMPTY_VOUCHER_STATS: BillingVoucherStats = {
  total: 0,
  adults: 0,
  paidChildren: 0,
  unpaidChildren: 0,
  kits: 0,
  optionalShirts: 0,
  optionalShirtsAmount: "0",
};

type ReservationVoucherWhere = Prisma.ReservationVoucherWhereInput;

/**
 * Conta vouchers das reservas não canceladas (opcionalmente filtradas por reservedAt).
 * Criança paga: idade >= 6 e não cortesia; demais crianças entram como não pagas.
 * Kits: adultos com hasBreakfastKit.
 */
export async function loadBillingVoucherStats(
  reservationWhere: Prisma.ReservationWhereInput
): Promise<BillingVoucherStats> {
  const where: ReservationVoucherWhere = {
    reservation: reservationWhere,
    voidedAt: null,
  };

  const vouchers = await prisma.reservationVoucher.findMany({
    where,
    select: {
      personType: true,
      personIndex: true,
      age: true,
      hasBreakfastKit: true,
      hasOptionalPaidShirt: true,
      optionalShirtPrice: true,
      reservation: {
        select: {
          childrenCourtesySelections: true,
        },
      },
    },
  });

  let adults = 0;
  let paidChildren = 0;
  let unpaidChildren = 0;
  let kits = 0;
  let optionalShirts = 0;
  let optionalShirtsAmount = 0;

  for (const v of vouchers) {
    if (v.personType === "ADULT") {
      adults += 1;
      if (v.hasBreakfastKit) kits += 1;
      continue;
    }

    const age = v.age ?? 0;
    const isCourtesy = Boolean(v.reservation.childrenCourtesySelections[v.personIndex]);
    if (age >= 6 && !isCourtesy) paidChildren += 1;
    else unpaidChildren += 1;

    if (v.hasOptionalPaidShirt && v.optionalShirtPrice) {
      optionalShirts += 1;
      optionalShirtsAmount += Number.parseFloat(v.optionalShirtPrice.toString());
    }
  }

  return {
    total: vouchers.length,
    adults,
    paidChildren,
    unpaidChildren,
    kits,
    optionalShirts,
    optionalShirtsAmount: optionalShirtsAmount.toFixed(2),
  };
}
