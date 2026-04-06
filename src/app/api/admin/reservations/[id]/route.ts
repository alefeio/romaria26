import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminReservationStatusSchema } from "@/lib/validators/packages";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = adminReservationStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { status } = parsed.data;
  const now = new Date();

  const data: {
    status: typeof status;
    confirmedAt?: Date | null;
  } = { status };

  if (status === "CONFIRMED" && !existing.confirmedAt) {
    data.confirmedAt = now;
  }
  if (status === "PENDING") {
    data.confirmedAt = null;
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true, email: true } },
      package: { select: { id: true, name: true, slug: true, departureDate: true } },
    },
  });

  return jsonOk({
    item: {
      id: updated.id,
      status: updated.status,
      confirmedAt: updated.confirmedAt?.toISOString() ?? null,
      user: updated.user,
      package: {
        ...updated.package,
        departureDate: updated.package.departureDate.toISOString().slice(0, 10),
      },
    },
  });
}
