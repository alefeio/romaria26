import { z } from "zod";

const decimalLike = z.union([z.string(), z.number()]).transform((v) => String(v));

export const paymentMethodSchema = z.enum(["PIX", "CASH", "CARD", "TRANSFER", "OTHER"]);

export const adminCreateReservationPaymentSchema = z.object({
  amount: decimalLike,
  paidAt: z.string().datetime().optional(),
  method: paymentMethodSchema,
  note: z.string().max(20_000).optional().nullable(),
  receiptUrl: z.string().max(2000).optional().nullable(),
  /** Quando informado, liquida uma parcela SCHEDULED desta reserva e cria o pagamento informado. */
  installmentId: z.string().uuid().optional(),
});

export const adminCreateInstallmentSchema = z.object({
  dueDate: z
    .string()
    .transform((raw) => {
      const v = (raw ?? "").trim();
      // aceitar ISO datetime (pegar YYYY-MM-DD)
      const iso = v.match(/^(\d{4}-\d{2}-\d{2})T/);
      if (iso) return iso[1]!;
      // aceitar pt-BR (DD/MM/YYYY)
      const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (br) return `${br[3]}-${br[2]}-${br[1]}`;
      return v;
    })
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Data no formato AAAA-MM-DD."),
  amount: decimalLike,
  status: z.enum(["SCHEDULED", "PAID", "CANCELED"]).optional(),
  paidAt: z.string().datetime().optional().nullable(),
  method: paymentMethodSchema.optional().nullable(),
  note: z.string().max(20_000).optional().nullable(),
  receiptUrl: z.string().max(2000).optional().nullable(),
});

export const adminPatchInstallmentSchema = z.object({
  status: z.enum(["SCHEDULED", "PAID", "CANCELED"]),
  paidAt: z.string().datetime().optional().nullable(),
  method: paymentMethodSchema.optional().nullable(),
  note: z.string().max(20_000).optional().nullable(),
  receiptUrl: z.string().max(2000).optional().nullable(),
});

