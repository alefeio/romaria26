import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonOk } from "@/lib/http";

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const ymd = todayYmdUtc();
  const start = new Date(ymd + "T00:00:00.000Z");
  const end = new Date(ymd + "T23:59:59.999Z");

  const rows = await prisma.reservationPayment.findMany({
    where: { paidAt: { gte: start, lte: end } },
    orderBy: [{ paidAt: "desc" }],
    take: 500,
    select: { id: true, reservationId: true, amount: true, paidAt: true, method: true },
  });

  return jsonOk({
    ymd,
    items: rows.map((p) => ({
      id: p.id,
      reservationId: p.reservationId,
      amount: p.amount.toString(),
      paidAt: p.paidAt.toISOString(),
      method: p.method,
    })),
  });
}

