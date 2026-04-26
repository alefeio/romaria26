import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminCreateInstallmentSchema } from "@/lib/validators/payments";
import { recalcReservationPaymentStatus } from "@/lib/payments/reservation-payments";
import { createAuditLog } from "@/lib/audit";
import { sendReservationVouchersIfPaid } from "@/lib/vouchers/reservation-vouchers";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const body = await request.json().catch(() => null);
  const parsed = adminCreateInstallmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const d = parsed.data;

  const amount = new Prisma.Decimal(d.amount);
  const dueDate = dateFromYmd(d.dueDate);
  const status = d.status ?? "SCHEDULED";
  const paidAt = d.paidAt ? new Date(d.paidAt) : null;

  const created = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id }, select: { id: true } });
    if (!reservation) return null;

    const inst = await tx.reservationInstallment.create({
      data: {
        reservationId: id,
        amount,
        dueDate,
        status,
        paidAt: status === "PAID" ? (paidAt ?? new Date()) : null,
        method: d.method ?? null,
        note: d.note?.trim() || null,
        receiptUrl: d.receiptUrl?.trim() || null,
      },
    });

    if (inst.status === "PAID") {
      await tx.reservationPayment.create({
        data: {
          reservationId: id,
          amount: inst.amount,
          paidAt: inst.paidAt ?? new Date(),
          method: inst.method ?? "OTHER",
          note: `Parcela ${inst.dueDate.toISOString().slice(0, 10)} marcada como paga.`,
          receiptUrl: inst.receiptUrl ?? null,
        },
      });
      const payUpdated = await recalcReservationPaymentStatus(tx, id);
      return { inst, paymentStatus: payUpdated?.paymentStatus ?? null };
    }

    await createAuditLog({
      entityType: "Reservation",
      entityId: id,
      action: "RESERVATION_INSTALLMENT_CREATED",
      diff: { installmentId: inst.id, dueDate: d.dueDate, amount: d.amount, status: inst.status },
      performedByUserId: auth.id,
    });

    return { inst, paymentStatus: null };
  });

  if (!created) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  if (created.paymentStatus === "PAID") {
    await sendReservationVouchersIfPaid(id, auth.id).catch(() => null);
  }

  return jsonOk({ installment: { id: created.inst.id } }, { status: 201 });
}

