import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminPatchInstallmentSchema } from "@/lib/validators/payments";
import { recalcReservationPaymentStatus } from "@/lib/payments/reservation-payments";
import { createAuditLog } from "@/lib/audit";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string; installmentId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id, installmentId } = await ctx.params;
  if (!isUuid(id) || !isUuid(installmentId)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const body = await request.json().catch(() => null);
  const parsed = adminPatchInstallmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const d = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const inst = await tx.reservationInstallment.findFirst({
      where: { id: installmentId, reservationId: id },
    });
    if (!inst) return { err: "NOT_FOUND" as const };

    if (inst.status === "PAID" && d.status !== "PAID") {
      return { err: "INVALID_TRANSITION" as const };
    }

    if (d.status === "PAID" && inst.status !== "PAID") {
      const paidAt = d.paidAt ? new Date(d.paidAt) : new Date();
      const method = d.method ?? "OTHER";
      const note = d.note?.trim() ?? inst.note?.trim() ?? null;
      const receiptUrl = d.receiptUrl?.trim() ?? inst.receiptUrl?.trim() ?? null;

      await tx.reservationPayment.create({
        data: {
          reservationId: id,
          amount: inst.amount,
          paidAt,
          method,
          note: note ?? `Parcela ${inst.dueDate.toISOString().slice(0, 10)} marcada como paga.`,
          receiptUrl,
        },
      });

      const row = await tx.reservationInstallment.update({
        where: { id: installmentId },
        data: {
          status: "PAID",
          paidAt,
          method,
          note,
          receiptUrl,
        },
      });

      await recalcReservationPaymentStatus(tx, id);

      await createAuditLog({
        entityType: "Reservation",
        entityId: id,
        action: "RESERVATION_INSTALLMENT_UPDATED",
        diff: { installmentId, status: "PAID", paidAt: paidAt.toISOString(), method },
        performedByUserId: auth.id,
      });

      return { ok: row };
    }

    if (d.status === "PAID" && inst.status === "PAID") {
      const paidAt = d.paidAt ? new Date(d.paidAt) : inst.paidAt ?? new Date();
      const method = d.method ?? inst.method ?? "OTHER";
      const note = d.note !== undefined && d.note !== null ? d.note.trim() || null : inst.note;
      const receiptUrl =
        d.receiptUrl !== undefined && d.receiptUrl !== null ? d.receiptUrl.trim() || null : inst.receiptUrl;

      const row = await tx.reservationInstallment.update({
        where: { id: installmentId },
        data: {
          status: "PAID",
          paidAt,
          method,
          note,
          receiptUrl,
        },
      });

      await createAuditLog({
        entityType: "Reservation",
        entityId: id,
        action: "RESERVATION_INSTALLMENT_UPDATED",
        diff: { installmentId, status: "PAID", fields: ["paidAt", "method", "note", "receiptUrl"] },
        performedByUserId: auth.id,
      });

      return { ok: row };
    }

    const row = await tx.reservationInstallment.update({
      where: { id: installmentId },
      data: {
        status: d.status,
        paidAt: null,
        method: d.method ?? inst.method ?? null,
        note: d.note !== undefined && d.note !== null ? d.note.trim() || null : inst.note,
        receiptUrl:
          d.receiptUrl !== undefined && d.receiptUrl !== null ? d.receiptUrl.trim() || null : inst.receiptUrl,
      },
    });

    await createAuditLog({
      entityType: "Reservation",
      entityId: id,
      action: "RESERVATION_INSTALLMENT_UPDATED",
      diff: { installmentId, status: d.status },
      performedByUserId: auth.id,
    });

    return { ok: row };
  });

  if ("err" in updated && updated.err === "NOT_FOUND") {
    return jsonErr("NOT_FOUND", "Parcela não encontrada nesta reserva.", 404);
  }
  if ("err" in updated && updated.err === "INVALID_TRANSITION") {
    return jsonErr(
      "INVALID_TRANSITION",
      "Não é possível alterar o status de uma parcela já paga. Ajuste os pagamentos registrados se necessário.",
      400
    );
  }

  if (!("ok" in updated)) return jsonErr("UNKNOWN", "Falha ao atualizar parcela.", 500);

  return jsonOk({
    installment: {
      id: updated.ok.id,
      dueDate: updated.ok.dueDate.toISOString().slice(0, 10),
      amount: updated.ok.amount.toString(),
      status: updated.ok.status,
      paidAt: updated.ok.paidAt?.toISOString() ?? null,
      method: updated.ok.method,
      note: updated.ok.note,
      receiptUrl: updated.ok.receiptUrl,
    },
  });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string; installmentId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id, installmentId } = await ctx.params;
  if (!isUuid(id) || !isUuid(installmentId)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const deleted = await prisma.$transaction(async (tx) => {
    const inst = await tx.reservationInstallment.findFirst({
      where: { id: installmentId, reservationId: id },
      select: { id: true, status: true, dueDate: true },
    });
    if (!inst) return { err: "NOT_FOUND" as const };
    if (inst.status === "PAID") return { err: "HAS_PAYMENT" as const };

    await tx.reservationInstallment.delete({ where: { id: installmentId } });

    await createAuditLog({
      entityType: "Reservation",
      entityId: id,
      action: "RESERVATION_INSTALLMENT_DELETED",
      diff: { installmentId, dueDate: inst.dueDate.toISOString().slice(0, 10), status: inst.status },
      performedByUserId: auth.id,
    });

    return { ok: true as const };
  });

  if ("err" in deleted && deleted.err === "NOT_FOUND") {
    return jsonErr("NOT_FOUND", "Parcela não encontrada nesta reserva.", 404);
  }
  if ("err" in deleted && deleted.err === "HAS_PAYMENT") {
    return jsonErr("INVALID_STATE", "Não é possível excluir uma parcela já paga.", 400);
  }

  return jsonOk({ ok: true });
}
