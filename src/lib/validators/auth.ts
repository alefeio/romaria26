import { z } from "zod";

export const setupSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").toLowerCase(),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").toLowerCase(),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

/** Login apenas por e-mail. Aceita `login` ou (legado) `email` no corpo. */
export const loginSchema = z
  .object({
    login: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, "Senha é obrigatória"),
  })
  .superRefine((data, ctx) => {
    const raw = (data.login ?? data.email ?? "").trim();
    if (!raw) {
      ctx.addIssue({
        code: "custom",
        path: ["login"],
        message: "Informe o e-mail.",
      });
      return;
    }
    const lower = raw.toLowerCase();
    const isEmail = z.string().email().safeParse(lower).success;
    if (!isEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["login"],
        message: "Informe um e-mail válido.",
      });
    }
  })
  .transform((data) => {
    const raw = (data.login ?? data.email ?? "").trim().toLowerCase();
    return { login: raw, password: data.password };
  });
