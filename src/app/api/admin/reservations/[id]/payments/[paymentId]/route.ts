import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { recalcReservationPaymentStatus } from "@/lib/payments/reservation-payments";
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

/**
 * Descobre a parcela ligada ao pagamento (fora da transação de exclusão).
 * Não deve ser chamado dentro de um $transaction se puder falhar — no Postgres,
 * um erro aborta todo o bloco e gera "current transaction is aborted".
 */
async function findInstallmentIdLinkedToPayment(
  reservationId: string,
  paymentId: string,
  payment: { amount: Prisma.Decimal; method: PaymentMethod }
): Promise<string | null> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: "Reservation",
        entityId: reservationId,
        action: "RESERVATION_INSTALLMENT_PAID_VIA_PAYMENT",
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { diffJson: true },
    });

    for (const log of logs) {
      const diff = parseAuditDiff(log.diffJson);
      if (diff.paymentId === paymentId && typeof diff.installmentId === "string" && isUuid(diff.installmentId)) {
        return diff.installmentId;
      }
    }
  } catch (e) {
    console.error("[DELETE payment] leitura de audit para parcela vinculada", e);
  }

  try {
    const match = await prisma.reservationInstallment.findFirst({
      where: {
        reservationId,
        status: "PAID",
        amount: payment.amount,
        method: payment.method,
      },
      orderBy: { paidAt: "desc" },
      select: { id: true },
    });
    return match?.id ?? null;
  } catch (e) {
    console.error("[DELETE payment] fallback de parcela vinculada", e);
    return null;
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id, paymentId } = await ctx.params;
  if (!isUuid(id) || !isUuid(paymentId)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  try {
    const payment = await prisma.reservationPayment.findFirst({
      where: { id: paymentId, reservationId: id },
    });
    if (!payment) {
      return jsonErr("NOT_FOUND", "Pagamento não encontrado nesta reserva.", 404);
    }

    // Resolver parcela ANTES da exclusão, fora da interactive transaction.
    const installmentId = await findInstallmentIdLinkedToPayment(id, paymentId, payment);

    const updated = await prisma.$transaction(async (tx) => {
      const stillThere = await tx.reservationPayment.findFirst({
        where: { id: paymentId, reservationId: id },
        select: { id: true },
      });
      if (!stillThere) return null;

      await tx.reservationPayment.delete({ where: { id: paymentId } });
      return recalcReservationPaymentStatus(tx, id);
    });

    if (!updated) {
      return jsonErr("NOT_FOUND", "Pagamento não encontrado nesta reserva.", 404);
    }

    if (installmentId) {
      try {
        await prisma.reservationInstallment.updateMany({
          where: { id: installmentId, reservationId: id, status: "PAID" },
          data: {
            status: "SCHEDULED",
            paidAt: null,
            method: null,
          },
        });
      } catch (e) {
        console.error("[DELETE payment] não foi possível reabrir a parcela vinculada", e);
      }
    }

    await createAuditLog({
      entityType: "Reservation",
      entityId: id,
      action: "RESERVATION_PAYMENT_DELETED",
      diff: {
        paymentId,
        amount: payment.amount.toString(),
        paidAt: payment.paidAt.toISOString(),
        method: payment.method,
        installmentId,
        paymentStatus: updated.paymentStatus,
      },
      performedByUserId: auth.id,
    }).catch((e) => console.error("[DELETE payment] audit log falhou", e));

    return jsonOk({
      reservation: {
        id: updated.id,
        paymentStatus: updated.paymentStatus,
        totalPaid: updated.totalPaid.toString(),
      },
    });
  } catch (e) {
    console.error("[DELETE payment]", e);
    const msg = e instanceof Error ? e.message : "Falha ao excluir pagamento.";
    return jsonErr("DELETE_FAILED", msg, 500);
  }
}
