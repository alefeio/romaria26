import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

export async function GET() {
  const session = await getSessionUserFromCookie();
  if (!session) {
    return jsonErr("UNAUTHORIZED", "Faça login para continuar.", 401);
  }
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) {
    return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  }
  return jsonOk({ user });
}

export async function PATCH(request: Request) {
  const session = await getSessionUserFromCookie();
  if (!session) {
    return jsonErr("UNAUTHORIZED", "Faça login para continuar.", 401);
  }
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const updated = await prisma.user.update({
    where: { id: session.id },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, email: true, role: true },
  });
  return jsonOk({ user: updated });
}
