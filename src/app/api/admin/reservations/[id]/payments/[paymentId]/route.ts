import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { recalcReservationPaymentStatus, type ReservationDbClient } from "@/lib/payments/reservation-payments";
import { createAuditLog } from "@/lib/audit";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function parseAuditDiff(diffJson: string): Record<string, unknown> {
  try {
    const v = JSON.parse(diffJson) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Se o pagamento liquidou uma parcela, volta a parcela para agendada. */
async function revertInstallmentLinkedToPayment(
  tx: ReservationDbClient,
  reservationId: string,
  paymentId: string,
  payment: { amount: Prisma.Decimal; paidAt: Date; method: PaymentMethod }
) {
  const logs = await tx.auditLog.findMany({
    where: {
      entityType: "Reservation",
      entityId: reservationId,
      action: "RESERVATION_INSTALLMENT_PAID_VIA_PAYMENT",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  let installmentId: string | null = null;
  for (const log of logs) {
    const diff = parseAuditDiff(log.diffJson);
    if (diff.paymentId === paymentId && typeof diff.installmentId === "string") {
      installmentId = diff.installmentId;
      break;
    }
  }

  if (!installmentId) {
    const match = await tx.reservationInstallment.findFirst({
      where: {
        reservationId,
        status: "PAID",
        amount: payment.amount,
        paidAt: payment.paidAt,
        method: payment.method,
      },
      select: { id: true },
    });
    installmentId = match?.id ?? null;
  }

  if (!installmentId) return;

  const inst = await tx.reservationInstallment.findFirst({
    where: { id: installmentId, reservationId },
    select: { id: true, status: true },
  });
  if (!inst || inst.status !== "PAID") return;

  await tx.reservationInstallment.update({
    where: { id: installmentId },
    data: {
      status: "SCHEDULED",
      paidAt: null,
    },
  });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id, paymentId } = await ctx.params;
  if (!isUuid(id) || !isUuid(paymentId)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.reservationPayment.findFirst({
      where: { id: paymentId, reservationId: id },
    });
    if (!payment) return { err: "NOT_FOUND" as const };

    await revertInstallmentLinkedToPayment(tx, id, paymentId, payment);

    await tx.reservationPayment.delete({ where: { id: paymentId } });

    const updated = await recalcReservationPaymentStatus(tx, id);

    await createAuditLog({
      entityType: "Reservation",
      entityId: id,
      action: "RESERVATION_PAYMENT_DELETED",
      diff: {
        paymentId,
        amount: payment.amount.toString(),
        paidAt: payment.paidAt.toISOString(),
        method: payment.method,
        paymentStatus: updated?.paymentStatus,
      },
      performedByUserId: auth.id,
    });

    return { ok: updated };
  });

  if ("err" in result && result.err === "NOT_FOUND") {
    return jsonErr("NOT_FOUND", "Pagamento não encontrado nesta reserva.", 404);
  }

  return jsonOk({
    reservation: result.ok
      ? {
          id: result.ok.id,
          paymentStatus: result.ok.paymentStatus,
          totalPaid: result.ok.totalPaid.toString(),
        }
      : null,
  });
}
