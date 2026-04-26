import { z } from "zod";

/** Corpo de criação de reserva no painel, em nome de um cliente existente. */
export const adminCreateReservationForCustomerSchema = z
  .object({
    userId: z.string().uuid("Cliente inválido."),
    packageId: z.string().uuid("Pacote inválido."),
    quantity: z.coerce.number().int().min(1),
    adultsCount: z.coerce.number().int().min(0),
    childrenCount: z.coerce.number().int().min(0),
    adultNames: z.array(z.string()),
    adultShirtSizes: z.array(z.string()),
    childrenNames: z.array(z.string()),
    childrenAges: z.array(z.coerce.number()),
    childrenShirtNumbers: z.array(z.coerce.number()),
    breakfastSelections: z.array(z.boolean()),
    breakfastKitSelections: z.array(z.boolean()),
    paymentPreferenceMethod: z.string().min(1, "Informe o tipo de pagamento.").max(30),
    paymentPreferenceInstallments: z.coerce.number().int().min(1).max(12).nullish(),
    customerNameSnapshot: z.string().min(1, "Informe o nome do cliente.").max(500),
    customerEmailSnapshot: z.string().min(1, "Informe o e-mail de contato.").max(500),
    customerPhoneSnapshot: z.string().min(1, "Informe o telefone de contato.").max(50),
    notes: z.string().max(20_000).nullish(),
    initialStatus: z.enum(["PENDING", "CONFIRMED"]).optional(),
  })
  .refine((d) => d.adultsCount + d.childrenCount === d.quantity, {
    message: "A soma de adultos e crianças deve ser igual ao total de ingressos.",
    path: ["quantity"],
  })
  .refine((d) => d.paymentPreferenceMethod.trim().toUpperCase() !== "CARTAO" || Boolean(d.paymentPreferenceInstallments), {
    message: "Informe o número de parcelas quando o pagamento for no cartão.",
    path: ["paymentPreferenceInstallments"],
  });
