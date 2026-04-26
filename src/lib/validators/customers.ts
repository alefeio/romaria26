import { z } from "zod";

const digits = (v: string) => v.replace(/\D/g, "");

const phoneField = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null ? null : digits(v)))
  .refine((v) => v == null || v === "" || v.length === 11, "Telefone deve ter 11 dígitos (DDD + celular).")
  .transform((v) => (v && v !== "" ? v : null));

const cpfField = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null ? null : digits(v)))
  .refine((v) => v == null || v === "" || v.length === 11, "CPF deve ter 11 dígitos.")
  .transform((v) => (v && v !== "" ? v : null));

const emailInput = z.preprocess(
  (v) => (v == null || v === undefined ? "" : String(v).trim()),
  z
    .string()
    .refine((s) => s === "" || z.string().email().safeParse(s).success, "E-mail inválido.")
);

export const adminCustomerCreateSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório").max(200),
  email: emailInput,
  phone: phoneField,
  cpf: cpfField,
});

export const adminCustomerUpdateSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório").max(200).optional(),
  email: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : v),
    z.string().email("E-mail inválido.").optional()
  ),
  phone: phoneField.optional(),
  cpf: cpfField.optional(),
});
