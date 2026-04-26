import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

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

  const expiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.reservation.updateMany({
    where: { status: "PENDING", reservedAt: { lt: expiry } },
    data: { status: "CANCELLED", confirmedAt: null },
  });

  return jsonOk({ cancelled: result.count });
}

