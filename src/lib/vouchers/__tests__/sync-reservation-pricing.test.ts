import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { computeReservationPricingFromVouchers } from "@/lib/vouchers/sync-reservation-pricing";

const adultUnit = new Prisma.Decimal("100");
const childUnit = new Prisma.Decimal("50");
const kitUnit = new Prisma.Decimal("20");

const snapshots = {
  unitPriceSnapshot: adultUnit,
  amountAdultSnapshot: adultUnit,
  amountChildSnapshot: childUnit,
  breakfastKitUnitPriceSnapshot: kitUnit,
  adultCourtesySelections: [false, true],
  childrenCourtesySelections: [false],
};

const baseVoucherFields = {
  hasOptionalPaidShirt: false,
  optionalShirtPrice: null,
};

describe("computeReservationPricingFromVouchers", () => {
  it("soma adulto pago, criança >= 6 e kit café", () => {
    const pricing = computeReservationPricingFromVouchers(
      [
        {
          personType: "ADULT",
          personIndex: 0,
          name: "Ana",
          shirtSize: "M",
          age: null,
          hasBreakfastKit: true,
          ...baseVoucherFields,
        },
        {
          personType: "ADULT",
          personIndex: 1,
          name: "Cortesia",
          shirtSize: "G",
          age: null,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
        {
          personType: "CHILD",
          personIndex: 0,
          name: "João",
          shirtSize: "8",
          age: 8,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
      ],
      snapshots
    );

    expect(pricing.adultsCount).toBe(2);
    expect(pricing.childrenCount).toBe(1);
    expect(pricing.quantity).toBe(3);
    expect(pricing.paidAdultsCount).toBe(1);
    expect(pricing.paidChildrenCount).toBe(1);
    expect(pricing.kitCount).toBe(1);
    expect(pricing.totalPrice.toString()).toBe("170"); // 100 + 50 + 20
  });

  it("não cobra criança abaixo de 6 anos", () => {
    const pricing = computeReservationPricingFromVouchers(
      [
        {
          personType: "ADULT",
          personIndex: 0,
          name: "Ana",
          shirtSize: "M",
          age: null,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
        {
          personType: "CHILD",
          personIndex: 0,
          name: "Bebê",
          shirtSize: "Sem camisa",
          age: 3,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
      ],
      {
        ...snapshots,
        adultCourtesySelections: [false],
        childrenCourtesySelections: [false],
      }
    );

    expect(pricing.totalPrice.toString()).toBe("100");
  });

  it("soma camisa opcional de criança gratuita", () => {
    const pricing = computeReservationPricingFromVouchers(
      [
        {
          personType: "ADULT",
          personIndex: 0,
          name: "Ana",
          shirtSize: "M",
          age: null,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
        {
          personType: "CHILD",
          personIndex: 0,
          name: "Bebê",
          shirtSize: "6",
          age: 4,
          hasBreakfastKit: false,
          hasOptionalPaidShirt: true,
          optionalShirtPrice: new Prisma.Decimal("35"),
        },
      ],
      {
        ...snapshots,
        adultCourtesySelections: [false],
        childrenCourtesySelections: [false],
      }
    );

    expect(pricing.optionalShirtCount).toBe(1);
    expect(pricing.optionalShirtTotal.toString()).toBe("35");
    expect(pricing.totalPrice.toString()).toBe("135"); // 100 + 35
    expect(pricing.childrenOptionalShirtIncluded).toEqual([true]);
    expect(pricing.childrenOptionalShirtPrices).toEqual([35]);
  });

  it("usa cortesia pelo personIndex, não pela posição no array", () => {
    const pricing = computeReservationPricingFromVouchers(
      [
        {
          personType: "ADULT",
          personIndex: 0,
          name: "Pago",
          shirtSize: "M",
          age: null,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
        {
          personType: "ADULT",
          personIndex: 2,
          name: "Cortesia",
          shirtSize: "G",
          age: null,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
      ],
      {
        ...snapshots,
        adultCourtesySelections: [false, false, true],
        childrenCourtesySelections: [],
      }
    );

    expect(pricing.paidAdultsCount).toBe(1);
    expect(pricing.totalPrice.toString()).toBe("100");
  });

  it("aumenta total ao adicionar novo adulto pago", () => {
    const base = computeReservationPricingFromVouchers(
      [
        {
          personType: "ADULT",
          personIndex: 0,
          name: "Ana",
          shirtSize: "M",
          age: null,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
      ],
      { ...snapshots, adultCourtesySelections: [false], childrenCourtesySelections: [] }
    );

    const withExtra = computeReservationPricingFromVouchers(
      [
        {
          personType: "ADULT",
          personIndex: 0,
          name: "Ana",
          shirtSize: "M",
          age: null,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
        {
          personType: "ADULT",
          personIndex: 1,
          name: "Bruno",
          shirtSize: "G",
          age: null,
          hasBreakfastKit: false,
          ...baseVoucherFields,
        },
      ],
      { ...snapshots, adultCourtesySelections: [false, false], childrenCourtesySelections: [] }
    );

    expect(withExtra.totalPrice.sub(base.totalPrice).toString()).toBe("100");
    expect(withExtra.quantity).toBe(2);
  });
});
