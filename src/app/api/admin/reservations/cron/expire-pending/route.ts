import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { expireStalePendingReservations } from "@/lib/reservations/create-reservation";

/**
 * Endpoint para cron: expira reservas PENDING com mais de 24h (vira CANCELLED).
 * Protegido por RESERVATION_CRON_SECRET (header Authorization: Bearer <secret> ou query ?secret=).
 */
export async function GET(request: Request) {
  const secret = process.env.RESERVATION_CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? querySecret;
  if (!secret || provided !== secret) {
    return jsonErr("UNAUTHORIZED", "Cron secret inválido.", 401);
  }

  const cancelled = await expireStalePendingReservations(prisma);

  return jsonOk({ cancelled });
}
