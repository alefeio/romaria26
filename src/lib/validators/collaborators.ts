import { z } from "zod";

export const adminCreateCollaboratorSchema = z.object({
  packageId: z.string().uuid("Selecione um pacote válido."),
  name: z.string().min(1, "Informe o nome do colaborador.").max(200),
  email: z.string().email("Informe um e-mail válido.").max(200),
  phone: z.string().max(50).optional().nullable(),
  roleLabel: z.string().max(100).optional().nullable(),
  shirtSize: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
