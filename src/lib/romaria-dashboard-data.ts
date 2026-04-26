import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { addCalendarDaysYmd, labelDayLongPtYmd, ymdTodayBrazil } from "@/lib/datetime-brazil";
import { prisma } from "@/lib/prisma";

export type RomariaRecentReservation = {
  id: string;
  status: string;
  quantity: number;
  totalPrice: string;
  reservedAt: Date;
  customerNameSnapshot: string;
  package: { name: string; slug: string };
  user: { email: string };
};

export type RomariaInstallmentPreview = {
  id: string;
  reservationId: string;
  dueDate: string;
  amount: string;
  customerName: string;
  packageName: string;
  packageSlug: string;
};

export type RomariaExpectedPaymentsBucket = {
  count: number;
  totalBrl: string;
  items: RomariaInstallmentPreview[];
};

function toBrl(d: Prisma.Decimal | null | undefined): string {
  const v = d ?? new Prisma.Decimal(0);
  return v.toString();
}

function mapInstallmentRows(
  rows: {
    id: string;
    reservationId: string;
    dueDate: Date;
    amount: Prisma.Decimal;
    reservation: { customerNameSnapshot: string; package: { name: string; slug: string } };
  }[]
): RomariaInstallmentPreview[] {
  return rows.map((r) => ({
    id: r.id,
    reservationId: r.reservationId,
    dueDate: r.dueDate.toISOString().slice(0, 10),
    amount: r.amount.toString(),
    customerName: r.reservation.customerNameSnapshot,
    packageName: r.reservation.package.name,
    packageSlug: r.reservation.package.slug,
  }));
}

const installmentInclude = {
  reservation: {
    select: {
      customerNameSnapshot: true,
      package: { select: { name: true, slug: true } },
    },
  },
} as const;

export async function getRomariaAdminDashboard(): Promise<{
  packagesOpen: number;
  packagesTotal: number;
  reservationsPending: number;
  reservationsTotal: number;
  /** @deprecated usar expectedPaymentsToday */
  paymentsDueToday: number;
  expectedPayments: {
    today: RomariaExpectedPaymentsBucket;
    tomorrow: RomariaExpectedPaymentsBucket;
    overdue: RomariaExpectedPaymentsBucket;
  };
  /** Datas (AAAA-MM-DD) e rótulos para títulos do painel. */
  expectedPaymentLabels: { todayYmd: string; tomorrowYmd: string; todayLabel: string; tomorrowLabel: string };
  recentReservations: RomariaRecentReservation[];
}> {
  const todayYmd = ymdTodayBrazil();
  const tomorrowYmd = addCalendarDaysYmd(todayYmd, 1);
  const startOfToday = new Date(todayYmd + "T00:00:00.000Z");
  const endOfToday = new Date(todayYmd + "T23:59:59.999Z");
  const startOfTomorrow = new Date(tomorrowYmd + "T00:00:00.000Z");
  const endOfTomorrow = new Date(tomorrowYmd + "T23:59:59.999Z");

  const scheduled = { status: "SCHEDULED" as const };

  const [
    packagesOpen,
    packagesTotal,
    reservationsPending,
    reservationsTotal,
    recentRaw,
    aggToday,
    rowsToday,
    aggTomorrow,
    rowsTomorrow,
    aggOverdue,
    rowsOverdue,
  ] = await Promise.all([
    prisma.package.count({ where: { isActive: true, status: "OPEN" } }),
    prisma.package.count(),
    prisma.reservation.count({ where: { status: "PENDING" } }),
    prisma.reservation.count(),
    prisma.reservation.findMany({
      take: 10,
      orderBy: { reservedAt: "desc" },
      include: {
        package: { select: { name: true, slug: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.reservationInstallment.aggregate({
      where: { ...scheduled, dueDate: { gte: startOfToday, lte: endOfToday } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.reservationInstallment.findMany({
      where: { ...scheduled, dueDate: { gte: startOfToday, lte: endOfToday } },
      orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
      take: 8,
      include: installmentInclude,
    }),
    prisma.reservationInstallment.aggregate({
      where: { ...scheduled, dueDate: { gte: startOfTomorrow, lte: endOfTomorrow } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.reservationInstallment.findMany({
      where: { ...scheduled, dueDate: { gte: startOfTomorrow, lte: endOfTomorrow } },
      orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
      take: 8,
      include: installmentInclude,
    }),
    prisma.reservationInstallment.aggregate({
      where: { ...scheduled, dueDate: { lt: startOfToday } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.reservationInstallment.findMany({
      where: { ...scheduled, dueDate: { lt: startOfToday } },
      orderBy: [{ dueDate: "asc" }, { amount: "desc" }],
      take: 8,
      include: installmentInclude,
    }),
  ]);

  const recentReservations: RomariaRecentReservation[] = recentRaw.map((r) => ({
    id: r.id,
    status: r.status,
    quantity: r.quantity,
    totalPrice: r.totalPrice.toString(),
    reservedAt: r.reservedAt,
    customerNameSnapshot: r.customerNameSnapshot,
    package: r.package,
    user: r.user,
  }));

  const expectedPayments: {
    today: RomariaExpectedPaymentsBucket;
    tomorrow: RomariaExpectedPaymentsBucket;
    overdue: RomariaExpectedPaymentsBucket;
  } = {
    today: {
      count: aggToday._count._all,
      totalBrl: toBrl(aggToday._sum.amount),
      items: mapInstallmentRows(rowsToday),
    },
    tomorrow: {
      count: aggTomorrow._count._all,
      totalBrl: toBrl(aggTomorrow._sum.amount),
      items: mapInstallmentRows(rowsTomorrow),
    },
    overdue: {
      count: aggOverdue._count._all,
      totalBrl: toBrl(aggOverdue._sum.amount),
      items: mapInstallmentRows(rowsOverdue),
    },
  };

  return {
    packagesOpen,
    packagesTotal,
    reservationsPending,
    reservationsTotal,
    paymentsDueToday: expectedPayments.today.count,
    expectedPayments,
    expectedPaymentLabels: {
      todayYmd,
      tomorrowYmd,
      todayLabel: labelDayLongPtYmd(todayYmd),
      tomorrowLabel: labelDayLongPtYmd(tomorrowYmd),
    },
    recentReservations,
  };
}
