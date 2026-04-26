import "server-only";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { sendReservationVouchersIfPaid } from "@/lib/vouchers/reservation-vouchers";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { code } = await ctx.params;
  const c = decodeURIComponent(code ?? "").trim();
  if (!c) return jsonErr("INVALID_CODE", "Código inválido.", 400);

  const v = await prisma.reservationVoucher.findFirst({
    where: { code: c },
    select: { reservationId: true },
  });
  if (!v) return jsonErr("NOT_FOUND", "Voucher não encontrado.", 404);

  const result = await sendReservationVouchersIfPaid(v.reservationId, auth.id);
  if (!result.ok) {
    const msg =
      result.reason === "NOT_PAID"
        ? "A reserva ainda não está 100% paga."
        : result.reason === "NO_CUSTOMER_EMAIL"
          ? "O cliente não tem e-mail válido para envio."
          : "Não foi possível enviar.";
    return jsonErr("CANNOT_SEND", msg, 422);
  }

  // Mesmo se tiver sido enviado antes, retornamos ok (a função é idempotente).
  return jsonOk({ ok: true, skipped: (result as { skipped?: boolean }).skipped ?? false });
}

