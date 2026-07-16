import "server-only";

import type { ReservationDbClient } from "@/lib/payments/reservation-payments";
import { recalcReservationPaymentStatus } from "@/lib/payments/reservation-payments";

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
    },
  });
  if (!reservation) return null;

  const vouchers = await tx.reservationVoucher.findMany({
    where: { reservationId },
    orderBy: [{ personType: "asc" }, { personIndex: "asc" }],
  });

  const adults = vouchers
    .filter((v) => v.personType === "ADULT")
    .sort((a, b) => a.personIndex - b.personIndex);
  const children = vouchers
    .filter((v) => v.personType === "CHILD")
    .sort((a, b) => a.personIndex - b.personIndex);

  const adultCourtesies = adults.map((_, i) => Boolean(reservation.adultCourtesySelections[i]));
  const childCourtesies = children.map((_, i) => Boolean(reservation.childrenCourtesySelections[i]));

  const adultUnit = reservation.amountAdultSnapshot.greaterThan(0)
    ? reservation.amountAdultSnapshot
    : reservation.unitPriceSnapshot;
  const childUnit = reservation.amountChildSnapshot;
  const kitUnit = reservation.breakfastKitUnitPriceSnapshot;

  const paidAdultsCount = adultCourtesies.filter((isCourtesy) => !isCourtesy).length;
  const paidChildrenCount = children.filter((c, index) => {
    const age = c.age ?? 0;
    return age >= 6 && !childCourtesies[index];
  }).length;
  const kitCount = adults.filter((a) => a.hasBreakfastKit).length;

  const totalPrice = adultUnit
    .mul(paidAdultsCount)
    .add(childUnit.mul(paidChildrenCount))
    .add(kitUnit.mul(kitCount));

  const adultNames = adults.map((a) => a.name);
  const adultShirtSizes = adults.map((a) => a.shirtSize);
  const breakfastKitSelections = adults.map((a) => a.hasBreakfastKit);
  const childrenNames = children.map((c) => c.name);
  const childrenAges = children.map((c) => (c.age != null && Number.isInteger(c.age) ? c.age : 0));
  const childrenShirtNumbers = children.map((c) => {
    const n = Number.parseInt(String(c.shirtSize).replace(/\D/g, ""), 10);
    return Number.isInteger(n) && n > 0 ? n : 1;
  });

  const adultsCount = adults.length;
  const childrenCount = children.length;
  const quantity = adultsCount + childrenCount;

  const updated = await tx.reservation.update({
    where: { id: reservationId },
    data: {
      adultsCount,
      childrenCount,
      quantity,
      adultNames,
      adultShirtSizes,
      adultCourtesySelections: adultCourtesies,
      childrenNames,
      childrenAges,
      childrenShirtNumbers,
      childrenCourtesySelections: childCourtesies,
      breakfastKitSelections,
      includesBreakfastKit: breakfastKitSelections.some(Boolean),
      breakfastSelections: Array.from({ length: quantity }, () => false),
      totalPrice,
      totalDue: totalPrice,
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

  return {
    ...updated,
    totalPaid: pay?.totalPaid ?? updated.totalPaid,
    paymentStatus: pay?.paymentStatus ?? updated.paymentStatus,
  };
}
