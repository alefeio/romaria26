import { z } from "zod";

const digits = (v: string) => v.replace(/\D/g, "");

export const adminCustomerCreateSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório").max(200),
  email: z.string().email("E-mail inválido").toLowerCase(),
  phone: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v == null ? null : digits(v)))
    .refine((v) => v == null || v === "" || v.length === 11, "Telefone deve ter 11 dígitos (DDD + celular).")
    .transform((v) => (v && v !== "" ? v : null)),
  cpf: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v == null ? null : digits(v)))
    .refine((v) => v == null || v === "" || v.length === 11, "CPF deve ter 11 dígitos.")
    .transform((v) => (v && v !== "" ? v : null)),
});

export const adminCustomerUpdateSchema = adminCustomerCreateSchema.partial();

