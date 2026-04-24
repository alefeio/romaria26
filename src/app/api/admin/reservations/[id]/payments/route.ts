import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminCreateReservationPaymentSchema } from "@/lib/validators/payments";
import { recalcReservationPaymentStatus } from "@/lib/payments/reservation-payments";
import { createAuditLog } from "@/lib/audit";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      payments: { orderBy: [{ paidAt: "desc" }] },
      installments: { orderBy: [{ dueDate: "asc" }] },
      package: { select: { id: true, name: true, slug: true, departureDate: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!reservation) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  return jsonOk({
    reservation: {
      id: reservation.id,
      user: reservation.user,
      package: { ...reservation.package, departureDate: reservation.package.departureDate.toISOString().slice(0, 10) },
      quantity: reservation.quantity,
      adultsCount: reservation.adultsCount,
      childrenCount: reservation.childrenCount,
      totalDue: reservation.totalDue.toString(),
      totalPaid: reservation.totalPaid.toString(),
      paymentStatus: reservation.paymentStatus,
      totalPrice: reservation.totalPrice.toString(),
    },
    payments: reservation.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      paidAt: p.paidAt.toISOString(),
      method: p.method,
      note: p.note,
      receiptUrl: p.receiptUrl,
      createdAt: p.createdAt.toISOString(),
    })),
    installments: reservation.installments.map((i) => ({
      id: i.id,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      amount: i.amount.toString(),
      status: i.status,
      paidAt: i.paidAt?.toISOString() ?? null,
      method: i.method,
      note: i.note,
      receiptUrl: i.receiptUrl,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const body = await request.json().catch(() => null);
  const parsed = adminCreateReservationPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;
  const paidAt = d.paidAt ? new Date(d.paidAt) : new Date();
  const amount = new Prisma.Decimal(d.amount);

  let installmentDueYmd: string | null = null;
  if (d.installmentId) {
    if (!isUuid(d.installmentId)) {
      return jsonErr("VALIDATION_ERROR", "ID da parcela inválido.", 400);
    }
    const inst = await prisma.reservationInstallment.findFirst({
      where: { id: d.installmentId, reservationId: id },
      select: { id: true, status: true, dueDate: true },
    });
    if (!inst) return jsonErr("NOT_FOUND", "Parcela não encontrada nesta reserva.", 404);
    if (inst.status !== "SCHEDULED") {
      return jsonErr("INVALID_STATE", "Só é possível registrar pagamento vinculado a parcelas agendadas.", 400);
    }
    installmentDueYmd = inst.dueDate.toISOString().slice(0, 10);
  }

  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id }, select: { id: true, totalDue: true } });
    if (!reservation) return null;

    const payment = await tx.reservationPayment.create({
      data: {
        reservationId: id,
        amount,
        paidAt,
        method: d.method,
        note: d.note?.trim() || null,
        receiptUrl: d.receiptUrl?.trim() || null,
      },
    });

    if (d.installmentId && installmentDueYmd) {
      await tx.reservationInstallment.update({
        where: { id: d.installmentId },
        data: {
          status: "PAID",
          paidAt,
          method: d.method,
          note: d.note?.trim() || null,
          receiptUrl: d.receiptUrl?.trim() || null,
        },
      });
      await createAuditLog({
        entityType: "Reservation",
        entityId: id,
        action: "RESERVATION_INSTALLMENT_PAID_VIA_PAYMENT",
        diff: {
          installmentId: d.installmentId,
          dueDate: installmentDueYmd,
          paymentId: payment.id,
          amount: d.amount,
          paidAt: paidAt.toISOString(),
          method: d.method,
        },
        performedByUserId: auth.id,
      });
    }

    const updated = await recalcReservationPaymentStatus(tx, id);

    await createAuditLog({
      entityType: "Reservation",
      entityId: id,
      action: "RESERVATION_PAYMENT_CREATED",
      diff: {
        amount: d.amount,
        paidAt: paidAt.toISOString(),
        method: d.method,
        paymentId: payment.id,
        installmentId: d.installmentId ?? null,
        paymentStatus: updated?.paymentStatus,
      },
      performedByUserId: auth.id,
    });

    return { payment, updated };
  });

  if (!result) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  return jsonOk(
    {
      payment: { id: result.payment.id },
      reservation: result.updated
        ? {
            id: result.updated.id,
            paymentStatus: result.updated.paymentStatus,
            totalPaid: result.updated.totalPaid.toString(),
          }
        : null,
    },
    { status: 201 }
  );
}

