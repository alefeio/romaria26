import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminCustomerCreateSchema } from "@/lib/validators/customers";
import { hashPassword } from "@/lib/auth";
import { generateTempPassword } from "@/lib/password";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, phone: true, cpf: true, isActive: true, createdAt: true },
    take: 500,
  });

  const userIds = customers.map((c) => c.id);
  const counts = await prisma.reservation.groupBy({
    by: ["userId"],
    _count: { _all: true },
    where: { userId: { in: userIds } },
  });
  const byUser = new Map(counts.map((c) => [c.userId, c._count._all]));

  const paymentCounts = await prisma.reservation.groupBy({
    by: ["userId", "paymentStatus"],
    _count: { _all: true },
    where: { userId: { in: userIds } },
  });
  const paymentByUser = new Map<string, Record<string, number>>();
  for (const row of paymentCounts) {
    const curr = paymentByUser.get(row.userId) ?? {};
    curr[row.paymentStatus] = row._count._all;
    paymentByUser.set(row.userId, curr);
  }

  return jsonOk({
    items: customers.map((c) => {
      const reservationsCount = byUser.get(c.id) ?? 0;
      const pay = paymentByUser.get(c.id) ?? {};
      const unpaid = (pay.UNPAID ?? 0) + (pay.PARTIAL ?? 0);
      const paid = pay.PAID ?? 0;
      const stage =
        reservationsCount === 0
          ? ("REGISTERED_ONLY" as const)
          : unpaid > 0
            ? ("HAS_RESERVATIONS_WITH_DUE" as const)
            : paid > 0
              ? ("HAS_RESERVATIONS_PAID" as const)
              : ("HAS_RESERVATIONS" as const);
      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        reservationsCount,
        paymentStatusCounts: {
          UNPAID: pay.UNPAID ?? 0,
          PARTIAL: pay.PARTIAL ?? 0,
          PAID: pay.PAID ?? 0,
          CANCELED: pay.CANCELED ?? 0,
        },
        stage,
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = adminCustomerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;
  const email = d.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (existing) {
    if (existing.role !== "CUSTOMER") {
      return jsonErr("EMAIL_IN_USE", "Este e-mail já existe e não é de cliente.", 409);
    }
    return jsonErr("EMAIL_IN_USE", "Este cliente já está cadastrado.", 409);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const created = await prisma.user.create({
    data: {
      name: d.name.trim(),
      email,
      phone: d.phone ?? null,
      cpf: d.cpf ?? null,
      passwordHash,
      role: "CUSTOMER",
      isActive: true,
      mustChangePassword: true,
      isAdmin: false,
    },
    select: { id: true, name: true, email: true, phone: true, cpf: true, isActive: true, createdAt: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "CUSTOMER_CREATED",
    diff: { created: { id: created.id, email: created.email, role: "CUSTOMER" } },
    performedByUserId: auth.id,
  });

  return jsonOk(
    {
      item: { ...created, createdAt: created.createdAt.toISOString() },
      temporaryPassword: tempPassword,
    },
    { status: 201 }
  );
}

