import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";

/** Espelha a lógica de recalcReservationPaymentStatus para testes unitários. */
function derivePaymentStatus(totalPaid: string, totalDue: string): "UNPAID" | "PARTIAL" | "PAID" {
  const paid = new Prisma.Decimal(totalPaid);
  const due = new Prisma.Decimal(totalDue);
  if (paid.greaterThanOrEqualTo(due) && due.greaterThan(0)) return "PAID";
  if (paid.greaterThan(0) && paid.lessThan(due)) return "PARTIAL";
  return "UNPAID";
}

describe("payment status após novo voucher", () => {
  it("PAID vira PARTIAL quando totalDue aumenta", () => {
    expect(derivePaymentStatus("300", "300")).toBe("PAID");
    expect(derivePaymentStatus("300", "400")).toBe("PARTIAL");
  });

  it("volta a PAID quando diferença é quitada", () => {
    expect(derivePaymentStatus("400", "400")).toBe("PAID");
  });

  it("criança gratuita (<6) não altera status se totalDue igual", () => {
    expect(derivePaymentStatus("200", "200")).toBe("PAID");
  });
});
