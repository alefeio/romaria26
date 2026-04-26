import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminReservationStatusSchema } from "@/lib/validators/packages";
import { createAuditLog } from "@/lib/audit";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      package: { select: { id: true, name: true, slug: true, departureDate: true, departureTime: true, boardingLocation: true } },
    },
  });
  if (!r) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  return jsonOk({
    item: {
      id: r.id,
      userId: r.userId,
      packageId: r.packageId,
      customerNameSnapshot: r.customerNameSnapshot,
      customerEmailSnapshot: r.customerEmailSnapshot,
      customerPhoneSnapshot: r.customerPhoneSnapshot,
      quantity: r.quantity,
      adultsCount: r.adultsCount,
      childrenCount: r.childrenCount,
      adultShirtSizes: r.adultShirtSizes,
      childrenShirtNumbers: r.childrenShirtNumbers,
      breakfastKitSelections: r.breakfastKitSelections,
      includesBreakfastKit: r.includesBreakfastKit,
      totalPrice: r.totalPrice.toString(),
      totalDue: r.totalDue.toString(),
      totalPaid: r.totalPaid.toString(),
      paymentStatus: r.paymentStatus,
      status: r.status,
      notes: r.notes,
      kitsDeliveryInfoSnapshot: r.kitsDeliveryInfoSnapshot ?? null,
      reservedAt: r.reservedAt.toISOString(),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      package: {
        ...r.package,
        departureDate: r.package.departureDate.toISOString().slice(0, 10),
      },
    },
  });
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

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const existing = await prisma.reservation.findUnique({
    where: { id },
    select: { id: true, userId: true, packageId: true, status: true, quantity: true, customerNameSnapshot: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  await prisma.reservation.delete({ where: { id } });

  await createAuditLog({
    entityType: "Reservation",
    entityId: id,
    action: "RESERVATION_DELETED",
    diff: {
      reservationId: id,
      userId: existing.userId,
      packageId: existing.packageId,
      status: existing.status,
      quantity: existing.quantity,
      customerNameSnapshot: existing.customerNameSnapshot,
    },
    performedByUserId: auth.id,
  });

  return jsonOk({ ok: true });
}
