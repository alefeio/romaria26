import "server-only";

import type { ReservationDbClient } from "@/lib/payments/reservation-payments";
import { recalcReservationPaymentStatus } from "@/lib/payments/reservation-payments";
import { computeReservationTotalDue } from "@/lib/payments/reservation-discount";
import { computeReservationPricingFromVouchers } from "@/lib/vouchers/sync-reservation-pricing";
import { releaseReservationVouchersIfPaid } from "@/lib/vouchers/voucher-release";
import { ACTIVE_VOUCHER_FILTER } from "@/lib/vouchers/reservation-vouchers";

/**
 * Recalcula contagens, arrays espelho e totais financeiros da reserva a partir dos vouchers.
 * Regras iguais à criação da reserva:
 * - adulto pago se não for cortesia
 * - criança paga se idade >= 6 e não for cortesia
 * - kit café: cobrança por adulto marcado (snapshot da reserva)
 */
export async function syncReservationFromVouchers(tx: ReservationDbClient, reservationId: string) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      unitPriceSnapshot: true,
      amountAdultSnapshot: true,
      amountChildSnapshot: true,
      breakfastKitUnitPriceSnapshot: true,
      adultCourtesySelections: true,
      childrenCourtesySelections: true,
      discountAmount: true,
    },
  });
  if (!reservation) return null;

  const vouchers = await tx.reservationVoucher.findMany({
    where: { reservationId, ...ACTIVE_VOUCHER_FILTER },
    orderBy: [{ personType: "asc" }, { personIndex: "asc" }],
    select: {
      personType: true,
      personIndex: true,
      name: true,
      age: true,
      shirtSize: true,
      hasBreakfastKit: true,
      hasOptionalPaidShirt: true,
      optionalShirtPrice: true,
    },
  });

  const pricing = computeReservationPricingFromVouchers(vouchers, reservation);
  const totalDue = computeReservationTotalDue(pricing.totalPrice, reservation.discountAmount);

  const updated = await tx.reservation.update({
    where: { id: reservationId },
    data: {
      adultsCount: pricing.adultsCount,
      childrenCount: pricing.childrenCount,
      quantity: pricing.quantity,
      adultNames: pricing.adultNames,
      adultShirtSizes: pricing.adultShirtSizes,
      adultCourtesySelections: pricing.adultCourtesySelections,
      childrenNames: pricing.childrenNames,
      childrenAges: pricing.childrenAges,
      childrenShirtNumbers: pricing.childrenShirtNumbers,
      childrenCourtesySelections: pricing.childrenCourtesySelections,
      childrenOptionalShirtIncluded: pricing.childrenOptionalShirtIncluded,
      childrenOptionalShirtPrices: pricing.childrenOptionalShirtPrices,
      breakfastKitSelections: pricing.breakfastKitSelections,
      includesBreakfastKit: pricing.includesBreakfastKit,
      breakfastSelections: pricing.breakfastSelections,
      totalPrice: pricing.totalPrice,
      totalDue,
    },
    select: {
      id: true,
      adultsCount: true,
      childrenCount: true,
      quantity: true,
      totalPrice: true,
      totalDue: true,
      paymentStatus: true,
      totalPaid: true,
    },
  });

  const pay = await recalcReservationPaymentStatus(tx, reservationId);
  await releaseReservationVouchersIfPaid(tx, reservationId);

  return {
    ...updated,
    totalPaid: pay?.totalPaid ?? updated.totalPaid,
    paymentStatus: pay?.paymentStatus ?? updated.paymentStatus,
  };
}
