import "server-only";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { sendReservationVouchersIfPaid } from "@/lib/vouchers/reservation-vouchers";
import { createAuditLog } from "@/lib/audit";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function sendFailureMessage(reason: string, error?: string): string {
  if (reason === "NOT_PAID") return "A reserva ainda não está 100% paga.";
  if (reason === "NO_CUSTOMER_EMAIL") return "O cliente não tem e-mail válido para envio.";
  if (reason === "NO_VOUCHERS") return "Esta reserva não tem vouchers para enviar.";
  if (reason === "EMAIL_FAILED") return error ?? "Falha ao enviar o e-mail ao cliente.";
  return "Não foi possível enviar.";
}

/** Admin: envia (ou reenvia) todos os vouchers da reserva ao e-mail do cliente. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!reservation) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  const result = await sendReservationVouchersIfPaid(id, auth.id, { force: true });
  if (!result.ok) {
    return jsonErr(
      "CANNOT_SEND",
      sendFailureMessage(result.reason, "error" in result ? result.error : undefined),
      422
    );
  }

  await createAuditLog({
    entityType: "Reservation",
    entityId: id,
    action: "RESERVATION_VOUCHERS_EMAIL_FORCED",
    diff: { via: "reservation_page" },
    performedByUserId: auth.id,
  }).catch(() => null);

  return jsonOk({ ok: true });
}
