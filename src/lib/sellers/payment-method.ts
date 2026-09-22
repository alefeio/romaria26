import type { PaymentMethod } from "@/generated/prisma/client";

const PREFERENCE_TO_METHOD: Record<string, PaymentMethod> = {
  PIX: "PIX",
  DINHEIRO: "CASH",
  CASH: "CASH",
  CARTAO: "CARD",
  CARD: "CARD",
  TRANSFERENCIA: "TRANSFER",
  TRANSFER: "TRANSFER",
  OUTRO: "OTHER",
  OTHER: "OTHER",
};

export function preferenceToPaymentMethod(raw: string | null | undefined): PaymentMethod | null {
  const key = String(raw ?? "").trim().toUpperCase();
  return PREFERENCE_TO_METHOD[key] ?? null;
}

export function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    PIX: "Pix",
    CASH: "Dinheiro",
    DINHEIRO: "Dinheiro",
    CARD: "Cartão",
    CARTAO: "Cartão",
    TRANSFER: "Transferência",
    TRANSFERENCIA: "Transferência",
    OTHER: "Outro",
    OUTRO: "Outro",
  };
  return labels[method] ?? method;
}
