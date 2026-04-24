import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminCustomerUpdateSchema } from "@/lib/validators/customers";
import { createAuditLog } from "@/lib/audit";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, cpf: true, isActive: true, role: true, createdAt: true },
  });
  if (!user || user.role !== "CUSTOMER") return jsonErr("NOT_FOUND", "Cliente não encontrado.", 404);

  const reservations = await prisma.reservation.findMany({
    where: { userId: id },
    orderBy: [{ reservedAt: "desc" }],
    include: { package: { select: { id: true, name: true, slug: true, departureDate: true } } },
    take: 200,
  });

  const agg = await prisma.reservation.aggregate({
    where: { userId: id },
    _sum: { totalDue: true, totalPaid: true },
  });
  const payCounts = await prisma.reservation.groupBy({
    by: ["paymentStatus"],
    _count: { _all: true },
    where: { userId: id },
  });
  const counts: Record<string, number> = {};
  for (const r of payCounts) counts[r.paymentStatus] = r._count._all;

  return jsonOk({
    item: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      paymentSummary: {
        totalDue: (agg._sum.totalDue ?? new Prisma.Decimal(0)).toString(),
        totalPaid: (agg._sum.totalPaid ?? new Prisma.Decimal(0)).toString(),
        counts: {
          UNPAID: counts.UNPAID ?? 0,
          PARTIAL: counts.PARTIAL ?? 0,
          PAID: counts.PAID ?? 0,
          CANCELED: counts.CANCELED ?? 0,
        },
      },
      reservations: reservations.map((r) => ({
        id: r.id,
        packageId: r.packageId,
        package: { ...r.package, departureDate: r.package.departureDate.toISOString().slice(0, 10) },
        quantity: r.quantity,
        totalPrice: r.totalPrice.toString(),
        totalDue: r.totalDue.toString(),
        totalPaid: r.totalPaid.toString(),
        paymentStatus: r.paymentStatus,
        status: r.status,
        reservedAt: r.reservedAt.toISOString(),
        confirmedAt: r.confirmedAt?.toISOString() ?? null,
      })),
    },
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true, email: true, phone: true, cpf: true, isActive: true },
  });
  if (!existing || existing.role !== "CUSTOMER") return jsonErr("NOT_FOUND", "Cliente não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = adminCustomerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const d = parsed.data;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name.trim() } : {}),
      ...(d.email !== undefined ? { email: d.email.trim().toLowerCase() } : {}),
      ...(d.phone !== undefined ? { phone: d.phone } : {}),
      ...(d.cpf !== undefined ? { cpf: d.cpf } : {}),
    },
    select: { id: true, name: true, email: true, phone: true, cpf: true, isActive: true, createdAt: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: updated.id,
    action: "CUSTOMER_UPDATED",
    diff: { updated: { name: updated.name, email: updated.email, phone: updated.phone, cpf: updated.cpf } },
    performedByUserId: auth.id,
  });

  return jsonOk({ item: { ...updated, createdAt: updated.createdAt.toISOString() } });
}

