import { Prisma } from "@/generated/prisma/client";
import type { VoucherPersonType } from "@/generated/prisma/client";
import { NO_SHIRT_LABEL, isFreeChildAge } from "@/lib/vouchers/shirt";

export type VoucherPricingRow = {
  personType: VoucherPersonType;
  personIndex: number;
  age: number | null;
  hasBreakfastKit: boolean;
  name: string;
  shirtSize: string;
  hasOptionalPaidShirt: boolean;
  optionalShirtPrice: Prisma.Decimal | null;
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
  optionalShirtCount: number;
  optionalShirtTotal: Prisma.Decimal;
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
  childrenOptionalShirtIncluded: boolean[];
  childrenOptionalShirtPrices: number[];
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

  let optionalShirtTotal = new Prisma.Decimal(0);
  let optionalShirtCount = 0;
  for (const child of children) {
    if (child.hasOptionalPaidShirt && child.optionalShirtPrice) {
      optionalShirtCount += 1;
      optionalShirtTotal = optionalShirtTotal.add(child.optionalShirtPrice);
    }
  }

  const totalPrice = adultUnit
    .mul(paidAdultsCount)
    .add(childUnit.mul(paidChildrenCount))
    .add(kitUnit.mul(kitCount))
    .add(optionalShirtTotal);

  const adultNames = adults.map((a) => a.name);
  const adultShirtSizes = adults.map((a) => a.shirtSize);
  const breakfastKitSelections = adults.map((a) => a.hasBreakfastKit);
  const childrenNames = children.map((c) => c.name);
  const childrenAges = children.map((c) => (c.age != null && Number.isInteger(c.age) ? c.age : 0));
  const childrenShirtNumbers = children.map((c) => {
    if (c.shirtSize === NO_SHIRT_LABEL) return 0;
    const n = Number.parseInt(String(c.shirtSize).replace(/\D/g, ""), 10);
    return Number.isInteger(n) && n > 0 ? n : 1;
  });
  const childrenOptionalShirtIncluded = children.map((c) => Boolean(c.hasOptionalPaidShirt));
  const childrenOptionalShirtPrices = children.map((c) =>
    c.hasOptionalPaidShirt && c.optionalShirtPrice ? Number.parseFloat(c.optionalShirtPrice.toString()) : 0
  );

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
    optionalShirtCount,
    optionalShirtTotal,
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
    childrenOptionalShirtIncluded,
    childrenOptionalShirtPrices,
    breakfastSelections: Array.from({ length: quantity }, () => false),
  };
}

export function resolveChildVoucherShirtFields(input: {
  age: number | null | undefined;
  shirtSize: string;
  hasOptionalPaidShirt?: boolean;
  optionalShirtPrice?: number | string | null;
}) {
  const age = input.age ?? 0;
  const freeChild = isFreeChildAge(age);
  const wantsShirt = Boolean(input.hasOptionalPaidShirt);
  const priceRaw =
    input.optionalShirtPrice == null || input.optionalShirtPrice === ""
      ? 0
      : Number.parseFloat(String(input.optionalShirtPrice).replace(",", "."));
  const price = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : 0;
  const hasOptionalPaidShirt = freeChild && wantsShirt && price > 0;

  if (freeChild && !hasOptionalPaidShirt) {
    return {
      shirtSize: NO_SHIRT_LABEL,
      hasOptionalPaidShirt: false,
      optionalShirtPrice: null as number | null,
    };
  }

  const shirtSize = input.shirtSize.trim() || (freeChild ? NO_SHIRT_LABEL : "");
  return {
    shirtSize,
    hasOptionalPaidShirt,
    optionalShirtPrice: hasOptionalPaidShirt ? price : null,
  };
}
