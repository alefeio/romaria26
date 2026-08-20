import { Prisma } from "@/generated/prisma/client";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminReservationDiscountSchema } from "@/lib/validators/payments";
import { createAuditLog } from "@/lib/audit";
import { applyReservationDiscountById } from "@/lib/payments/apply-reservation-discount";
import { sendReservationVouchersIfPaid } from "@/lib/vouchers/reservation-vouchers";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const body = await request.json().catch(() => null);
  const parsed = adminReservationDiscountSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const amountRaw = parsed.data.amount.replace(",", ".").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amountRaw)) {
    return jsonErr("VALIDATION_ERROR", "Informe um valor de desconto válido (ex.: 50 ou 50.00).", 400);
  }

  const amount = new Prisma.Decimal(amountRaw);
  const note = parsed.data.note ?? null;

  const result = await applyReservationDiscountById(id, { amount, note });
  if ("err" in result) {
    if (result.err === "NOT_FOUND") return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);
    if (result.err === "INVALID_AMOUNT") {
      return jsonErr("INVALID_AMOUNT", result.message, 422);
    }
    return jsonErr("INVALID_AMOUNT", "Valor de desconto inválido.", 422);
  }

  const item = result.ok;
  if (!item) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  await createAuditLog({
    entityType: "Reservation",
    entityId: id,
    action: "RESERVATION_DISCOUNT_APPLIED",
    diff: {
      previousDiscount: result.previousDiscount.toString(),
      discountAmount: item.discountAmount.toString(),
      discountNote: item.discountNote,
      totalDue: item.totalDue.toString(),
      paymentStatus: item.paymentStatus,
    },
    performedByUserId: auth.id,
  }).catch((e) => console.error("[PATCH discount] audit log falhou", e));

  if (item.paymentStatus === "PAID") {
    await sendReservationVouchersIfPaid(id, auth.id).catch(() => null);
  }

  return jsonOk({
    reservation: {
      id: item.id,
      totalPrice: item.totalPrice.toString(),
      discountAmount: item.discountAmount.toString(),
      discountNote: item.discountNote,
      totalDue: item.totalDue.toString(),
      totalPaid: item.totalPaid.toString(),
      paymentStatus: item.paymentStatus,
    },
  });
}
