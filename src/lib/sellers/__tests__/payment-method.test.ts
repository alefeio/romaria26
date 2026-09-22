import { describe, expect, it } from "vitest";
import { paymentMethodLabel, preferenceToPaymentMethod } from "@/lib/sellers/payment-method";

describe("preferenceToPaymentMethod", () => {
  it("converte a forma do balcão para o enum de pagamento", () => {
    expect(preferenceToPaymentMethod("PIX")).toBe("PIX");
    expect(preferenceToPaymentMethod("DINHEIRO")).toBe("CASH");
    expect(preferenceToPaymentMethod("CARTAO")).toBe("CARD");
    expect(preferenceToPaymentMethod("xyz")).toBeNull();
  });

  it("rotula métodos para o comprovante", () => {
    expect(paymentMethodLabel("CASH")).toBe("Dinheiro");
    expect(paymentMethodLabel("PIX")).toBe("Pix");
  });
});
