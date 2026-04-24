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

  const rows = await prisma.reservationInstallment.findMany({
    where: {
      status: "SCHEDULED",
      dueDate: { gte: start, lte: end },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 500,
    include: {
      reservation: {
        select: {
          id: true,
          userId: true,
          customerNameSnapshot: true,
          customerPhoneSnapshot: true,
          paymentStatus: true,
          totalDue: true,
          totalPaid: true,
          package: { select: { id: true, name: true, slug: true, departureDate: true } },
        },
      },
    },
  });

  return jsonOk({
    ymd,
    items: rows.map((r) => ({
      id: r.id,
      reservationId: r.reservationId,
      dueDate: r.dueDate.toISOString().slice(0, 10),
      amount: r.amount.toString(),
      reservation: {
        id: r.reservation.id,
        userId: r.reservation.userId,
        customerNameSnapshot: r.reservation.customerNameSnapshot,
        customerPhoneSnapshot: r.reservation.customerPhoneSnapshot,
        paymentStatus: r.reservation.paymentStatus,
        totalDue: r.reservation.totalDue.toString(),
        totalPaid: r.reservation.totalPaid.toString(),
        package: {
          ...r.reservation.package,
          departureDate: r.reservation.package.departureDate.toISOString().slice(0, 10),
        },
      },
    })),
  });
}

