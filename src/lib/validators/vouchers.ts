import { z } from "zod";

export const adminCreateVoucherSchema = z.object({
  personType: z.enum(["ADULT", "CHILD"]),
  personIndex: z.number().int().min(0).optional(),
  name: z.string().min(1, "Nome é obrigatório.").max(200),
  shirtSize: z.string().min(1, "Informe o tamanho da camisa.").max(20),
  age: z.number().int().min(0, "Idade da criança: 0 a 10 anos.").max(10).optional().nullable(),
  hasBreakfastKit: z.boolean().optional().default(false),
});

export const adminUpdateVoucherSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").max(200).optional(),
  shirtSize: z.string().min(1, "Informe o tamanho da camisa.").max(20).optional(),
  age: z.number().int().min(0).max(10).optional().nullable(),
  hasBreakfastKit: z.boolean().optional(),
  personIndex: z.number().int().min(0).optional(),
  personType: z.enum(["ADULT", "CHILD"]).optional(),
});
