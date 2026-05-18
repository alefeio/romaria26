import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminUpdateVoucherSchema } from "@/lib/validators/vouchers";
import { createAuditLog } from "@/lib/audit";
import { serializeVoucher, updateReservationVoucherAdmin } from "@/lib/vouchers/admin-voucher-crud";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; voucherId: string }> }
) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id, voucherId } = await ctx.params;
  if (!isUuid(id) || !isUuid(voucherId)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const body = await request.json().catch(() => null);
  const parsed = adminUpdateVoucherSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await updateReservationVoucherAdmin(tx, id, voucherId, {
        name: d.name,
        shirtSize: d.shirtSize,
        age: d.age,
        hasBreakfastKit: d.hasBreakfastKit,
        personIndex: d.personIndex,
        personType: d.personType,
      });
      if ("err" in updated) return updated;

      await createAuditLog({
        entityType: "Reservation",
        entityId: id,
        action: "RESERVATION_VOUCHER_UPDATED",
        diff: { voucherId, code: updated.ok.code },
        performedByUserId: auth.id,
      });

      return { ok: updated.ok };
    });

    if ("err" in result) {
      if (result.err === "NOT_FOUND") return jsonErr("NOT_FOUND", "Voucher não encontrado.", 404);
      if (result.err === "INDEX_IN_USE") {
        return jsonErr("INDEX_IN_USE", "Já existe um voucher para este tipo e índice.", 409);
      }
      return jsonErr("UNKNOWN", "Falha ao atualizar voucher.", 500);
    }

    return jsonOk({ voucher: serializeVoucher(result.ok) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao atualizar voucher.";
    if (msg.includes("Faixa de vouchers esgotada")) {
      return jsonErr("VOUCHER_RANGE_EXHAUSTED", msg, 409);
    }
    throw e;
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string; voucherId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id, voucherId } = await ctx.params;
  if (!isUuid(id) || !isUuid(voucherId)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const existing = await prisma.reservationVoucher.findFirst({
    where: { id: voucherId, reservationId: id },
    select: { id: true, code: true, name: true, usedAt: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Voucher não encontrado.", 404);

  await prisma.reservationVoucher.delete({ where: { id: voucherId } });

  await createAuditLog({
    entityType: "Reservation",
    entityId: id,
    action: "RESERVATION_VOUCHER_DELETED",
    diff: {
      voucherId,
      code: existing.code,
      name: existing.name,
      wasUsed: Boolean(existing.usedAt),
    },
    performedByUserId: auth.id,
  });

  return jsonOk({ deleted: true });
}
