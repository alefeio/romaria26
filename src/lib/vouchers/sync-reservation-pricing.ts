import { Prisma } from "@/generated/prisma/client";
import type { VoucherPersonType } from "@/generated/prisma/client";

export type VoucherPricingRow = {
  personType: VoucherPersonType;
  personIndex: number;
  age: number | null;
  hasBreakfastKit: boolean;
  name: string;
  shirtSize: string;
};

export type ReservationPricingSnapshots = {
  unitPriceSnapshot: Prisma.Decimal;
  amountAdultSnapshot: Prisma.Decimal;
  amountChildSnapshot: Prisma.Decimal;
  breakfastKitUnitPriceSnapshot: Prisma.Decimal;
  adultCourtesySelections: boolean[];
  childrenCourtesySelections: boolean[];
};

export type ReservationPricingTotals = {
  adultsCount: number;
  childrenCount: number;
  quantity: number;
  paidAdultsCount: number;
  paidChildrenCount: number;
  kitCount: number;
  totalPrice: Prisma.Decimal;
  adultNames: string[];
  adultShirtSizes: string[];
  adultCourtesySelections: boolean[];
  breakfastKitSelections: boolean[];
  includesBreakfastKit: boolean;
  childrenNames: string[];
  childrenAges: number[];
  childrenShirtNumbers: number[];
  childrenCourtesySelections: boolean[];
  breakfastSelections: boolean[];
};

function courtesyAt(selections: boolean[], personIndex: number): boolean {
  return Boolean(selections[personIndex]);
}

/** Recalcula contagens e totais a partir dos vouchers (mesmas regras da criação da reserva). */
export function computeReservationPricingFromVouchers(
  vouchers: VoucherPricingRow[],
  snapshots: ReservationPricingSnapshots
): ReservationPricingTotals {
  const adults = vouchers
    .filter((v) => v.personType === "ADULT")
    .sort((a, b) => a.personIndex - b.personIndex);
  const children = vouchers
    .filter((v) => v.personType === "CHILD")
    .sort((a, b) => a.personIndex - b.personIndex);

  const adultCourtesies = adults.map((a) => courtesyAt(snapshots.adultCourtesySelections, a.personIndex));
  const childCourtesies = children.map((c) => courtesyAt(snapshots.childrenCourtesySelections, c.personIndex));

  const adultUnit = snapshots.amountAdultSnapshot.greaterThan(0)
    ? snapshots.amountAdultSnapshot
    : snapshots.unitPriceSnapshot;
  const childUnit = snapshots.amountChildSnapshot;
  const kitUnit = snapshots.breakfastKitUnitPriceSnapshot;

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

  return {
    adultsCount,
    childrenCount,
    quantity,
    paidAdultsCount,
    paidChildrenCount,
    kitCount,
    totalPrice,
    adultNames,
    adultShirtSizes,
    adultCourtesySelections: adultCourtesies,
    breakfastKitSelections,
    includesBreakfastKit: breakfastKitSelections.some(Boolean),
    childrenNames,
    childrenAges,
    childrenShirtNumbers,
    childrenCourtesySelections: childCourtesies,
    breakfastSelections: Array.from({ length: quantity }, () => false),
  };
}
