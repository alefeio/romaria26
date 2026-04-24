import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonOk } from "@/lib/http";

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYmdToUtcDate(ymd: string, endOfDay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(ymd + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"));
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = from ? parseYmdToUtcDate(from, false) : null;
  const toDate = to ? parseYmdToUtcDate(to, true) : null;

  const dateFilter =
    fromDate || toDate
      ? {
          reservedAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : undefined;

  const baseWhere = {
    ...(dateFilter ?? {}),
    status: { not: "CANCELLED" as const },
  };

  const totals = await prisma.reservation.aggregate({
    where: baseWhere,
    _sum: { totalDue: true, totalPaid: true },
    _count: { _all: true },
  });

  const now = new Date();
  const today = ymdUtc(now);
  const todayStart = new Date(today + "T00:00:00.000Z");

  const overdueInstallments = await prisma.reservationInstallment.findMany({
    where: {
      status: "SCHEDULED",
      dueDate: { lt: todayStart },
    },
    orderBy: [{ dueDate: "asc" }],
    take: 500,
    include: {
      reservation: {
        select: {
          id: true,
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

  const overdueSum = overdueInstallments.reduce((acc, i) => acc.add(i.amount), new Prisma.Decimal(0));

  const unpaid = new Prisma.Decimal(totals._sum.totalDue ?? 0).sub(new Prisma.Decimal(totals._sum.totalPaid ?? 0));

  return jsonOk({
    range: {
      from: fromDate ? ymdUtc(fromDate) : null,
      to: toDate ? ymdUtc(toDate) : null,
    },
    totals: {
      reservationsCount: totals._count._all,
      totalDue: new Prisma.Decimal(totals._sum.totalDue ?? 0).toString(),
      totalPaid: new Prisma.Decimal(totals._sum.totalPaid ?? 0).toString(),
      totalToReceive: unpaid.toString(),
    },
    overdue: {
      count: overdueInstallments.length,
      totalAmount: overdueSum.toString(),
      items: overdueInstallments.map((i) => ({
        id: i.id,
        reservationId: i.reservationId,
        dueDate: i.dueDate.toISOString().slice(0, 10),
        amount: i.amount.toString(),
        reservation: {
          id: i.reservation.id,
          customerNameSnapshot: i.reservation.customerNameSnapshot,
          customerPhoneSnapshot: i.reservation.customerPhoneSnapshot,
          paymentStatus: i.reservation.paymentStatus,
          totalDue: i.reservation.totalDue.toString(),
          totalPaid: i.reservation.totalPaid.toString(),
          package: {
            ...i.reservation.package,
            departureDate: i.reservation.package.departureDate.toISOString().slice(0, 10),
          },
        },
      })),
    },
  });
}

