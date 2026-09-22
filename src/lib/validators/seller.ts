import { z } from "zod";

const digits = (v: string) => v.replace(/\D/g, "");

const phoneRequired = z
  .string()
  .transform((v) => digits(v))
  .refine((v) => v.length === 11, "Informe o WhatsApp com DDD (11 dígitos).");

const cpfOptional = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null ? null : digits(v)))
  .refine((v) => v == null || v === "" || v.length === 11, "CPF deve ter 11 dígitos.")
  .transform((v) => (v && v !== "" ? v : null));

const emailOptional = z.preprocess(
  (v) => (v == null || v === undefined ? "" : String(v).trim()),
  z
    .string()
    .refine((s) => s === "" || z.string().email().safeParse(s).success, "E-mail inválido.")
);

export const sellerCustomerCreateSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório").max(200),
  email: emailOptional,
  phone: phoneRequired,
  cpf: cpfOptional,
});

export const sellerSaleCreateSchema = z
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
    breakfastKitSelections: z.array(z.boolean()),
    paymentPreferenceMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "TRANSFERENCIA", "OUTRO"]),
    paymentPreferenceInstallments: z.coerce.number().int().min(1).max(12).nullish(),
    customerNameSnapshot: z.string().min(1, "Informe o nome do cliente.").max(500),
    customerEmailSnapshot: z.string().min(1).max(500),
    customerPhoneSnapshot: z.string().min(1).max(50),
    notes: z.string().max(20_000).nullish(),
  })
  .refine((d) => d.adultsCount + d.childrenCount === d.quantity, {
    message: "A soma de adultos e crianças deve ser igual ao total de ingressos.",
    path: ["quantity"],
  })
  .refine((d) => d.paymentPreferenceMethod !== "CARTAO" || Boolean(d.paymentPreferenceInstallments), {
    message: "Informe o número de parcelas quando o pagamento for no cartão.",
    path: ["paymentPreferenceInstallments"],
  });
