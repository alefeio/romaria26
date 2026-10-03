import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EMPTY_VOUCHER_STATS,
  loadBillingVoucherStats,
  type BillingVoucherStats,
} from "@/lib/billing/voucher-stats";

export function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseYmdToUtcDate(ymd: string, endOfDay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(ymd + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"));
}

export type SalesReportReservation = {
  id: string;
  reservedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  packageName: string;
  packageDepartureDate: string;
  adultsCount: number;
  childrenCount: number;
  quantity: number;
  /** Adultos com kit café (contagem a partir dos vouchers). */
  adultsWithKitCount: number;
  /** Adultos sem kit café. */
  adultsWithoutKitCount: number;
  /** Resumo: Com kit | Sem kit | Misto | - */
  kitCafeLabel: string;
  status: string;
  paymentStatus: string;
  totalDue: string;
  totalPaid: string;
  toReceive: string;
  paymentPreferenceMethod: string | null;
};

/** Um ingresso/voucher da reserva (kit café é por voucher, não por reserva). */
export type SalesReportVoucher = {
  id: string;
  code: string;
  name: string;
  personType: "ADULT" | "CHILD";
  shirtSize: string;
  hasBreakfastKit: boolean;
  customerName: string;
  packageName: string;
  packageDepartureDate: string;
  reservationId: string;
  reservedAt: string;
};

export type SalesReportPayment = {
  id: string;
  paidAt: string;
  amount: string;
  method: string;
  note: string | null;
  customerName: string;
  packageName: string;
  reservationId: string;
};

export type SalesReportOverdue = {
  id: string;
  dueDate: string;
  amount: string;
  customerName: string;
  customerPhone: string;
  packageName: string;
  reservationId: string;
  paymentStatus: string;
  totalDue: string;
  totalPaid: string;
};

export type SalesReportData = {
  generatedAt: string;
  range: { from: string | null; to: string | null };
  totals: {
    reservationsCount: number;
    totalPrice: string;
    totalDiscount: string;
    totalDue: string;
    totalPaid: string;
    totalToReceive: string;
    paymentsCount: number;
    paymentsAmount: string;
    overdueCount: number;
    overdueAmount: string;
    vouchers: BillingVoucherStats;
  };
  reservations: SalesReportReservation[];
  /** Ingressos/vouchers das reservas do período (kit café por voucher). */
  vouchers: SalesReportVoucher[];
  payments: SalesReportPayment[];
  overdue: SalesReportOverdue[];
};

function money(d: Prisma.Decimal | number | string | null | undefined): string {
  return new Prisma.Decimal(d?.toString() ?? "0").toString();
}

export async function loadSalesReportData(opts: {
  from?: string | null;
  to?: string | null;
}): Promise<SalesReportData> {
  const fromDate = opts.from ? parseYmdToUtcDate(opts.from, false) : null;
  const toDate = opts.to ? parseYmdToUtcDate(opts.to, true) : null;

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

  const paymentDateFilter =
    fromDate || toDate
      ? {
          paidAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : undefined;

  const now = new Date();
  const todayStart = new Date(ymdUtc(now) + "T00:00:00.000Z");

  const [reservations, payments, overdueInstallments, agg, voucherStats, voucherRows] = await Promise.all([
    prisma.reservation.findMany({
      where: baseWhere,
      orderBy: [{ reservedAt: "desc" }],
      take: 5000,
      include: {
        package: { select: { name: true, departureDate: true } },
      },
    }),
    prisma.reservationPayment.findMany({
      where: {
        ...(paymentDateFilter ?? {}),
        reservation: { status: { not: "CANCELLED" } },
      },
      orderBy: [{ paidAt: "desc" }],
      take: 5000,
      include: {
        reservation: {
          select: {
            id: true,
            customerNameSnapshot: true,
            package: { select: { name: true } },
          },
        },
      },
    }),
    prisma.reservationInstallment.findMany({
      where: {
        status: "SCHEDULED",
        dueDate: { lt: todayStart },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 2000,
      include: {
        reservation: {
          select: {
            id: true,
            customerNameSnapshot: true,
            customerPhoneSnapshot: true,
            paymentStatus: true,
            totalDue: true,
            totalPaid: true,
            package: { select: { name: true } },
          },
        },
      },
    }),
    prisma.reservation.aggregate({
      where: baseWhere,
      _sum: { totalPrice: true, discountAmount: true, totalDue: true, totalPaid: true },
      _count: { _all: true },
    }),
    loadBillingVoucherStats(baseWhere).catch(() => EMPTY_VOUCHER_STATS),
    prisma.reservationVoucher.findMany({
      where: {
        voidedAt: null,
        reservation: baseWhere,
      },
      orderBy: [{ code: "asc" }],
      take: 20_000,
      select: {
        id: true,
        code: true,
        name: true,
        personType: true,
        shirtSize: true,
        hasBreakfastKit: true,
        reservationId: true,
        reservation: {
          select: {
            customerNameSnapshot: true,
            reservedAt: true,
            package: { select: { name: true, departureDate: true } },
          },
        },
      },
    }),
  ]);

  const sumPrice = new Prisma.Decimal(money(agg._sum.totalPrice));
  const sumDiscount = new Prisma.Decimal(money(agg._sum.discountAmount));
  const sumDue = new Prisma.Decimal(money(agg._sum.totalDue));
  const sumPaid = new Prisma.Decimal(money(agg._sum.totalPaid));
  const paymentsAmount = payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
  const overdueAmount = overdueInstallments.reduce((acc, i) => acc.add(i.amount), new Prisma.Decimal(0));

  const kitCountsByReservation = new Map<string, { withKit: number; withoutKit: number }>();
  for (const v of voucherRows) {
    if (v.personType !== "ADULT") continue;
    const curr = kitCountsByReservation.get(v.reservationId) ?? { withKit: 0, withoutKit: 0 };
    if (v.hasBreakfastKit) curr.withKit += 1;
    else curr.withoutKit += 1;
    kitCountsByReservation.set(v.reservationId, curr);
  }

  return {
    generatedAt: now.toISOString(),
    range: {
      from: fromDate ? ymdUtc(fromDate) : null,
      to: toDate ? ymdUtc(toDate) : null,
    },
    totals: {
      reservationsCount: agg._count._all,
      totalPrice: sumPrice.toString(),
      totalDiscount: sumDiscount.toString(),
      totalDue: sumDue.toString(),
      totalPaid: sumPaid.toString(),
      totalToReceive: sumDue.sub(sumPaid).toString(),
      paymentsCount: payments.length,
      paymentsAmount: paymentsAmount.toString(),
      overdueCount: overdueInstallments.length,
      overdueAmount: overdueAmount.toString(),
      vouchers: voucherStats,
    },
    reservations: reservations.map((r) => {
      const due = new Prisma.Decimal(money(r.totalDue));
      const paid = new Prisma.Decimal(money(r.totalPaid));
      const fromVouchers = kitCountsByReservation.get(r.id);
      let adultsWithKitCount = fromVouchers?.withKit ?? 0;
      let adultsWithoutKitCount = fromVouchers?.withoutKit ?? 0;
      if (!fromVouchers && Array.isArray(r.breakfastKitSelections) && r.breakfastKitSelections.length > 0) {
        adultsWithKitCount = r.breakfastKitSelections.filter(Boolean).length;
        adultsWithoutKitCount = Math.max(0, r.adultsCount - adultsWithKitCount);
      }
      let kitCafeLabel = "-";
      if (adultsWithKitCount > 0 && adultsWithoutKitCount > 0) kitCafeLabel = "Misto";
      else if (adultsWithKitCount > 0) kitCafeLabel = "Com kit";
      else if (adultsWithoutKitCount > 0 || r.adultsCount > 0) kitCafeLabel = "Sem kit";
      return {
        id: r.id,
        reservedAt: r.reservedAt.toISOString(),
        customerName: r.customerNameSnapshot,
        customerEmail: r.customerEmailSnapshot,
        customerPhone: r.customerPhoneSnapshot,
        packageName: r.package.name,
        packageDepartureDate: r.package.departureDate.toISOString().slice(0, 10),
        adultsCount: r.adultsCount,
        childrenCount: r.childrenCount,
        quantity: r.quantity,
        adultsWithKitCount,
        adultsWithoutKitCount,
        kitCafeLabel,
        status: r.status,
        paymentStatus: r.paymentStatus,
        totalDue: due.toString(),
        totalPaid: paid.toString(),
        toReceive: due.sub(paid).toString(),
        paymentPreferenceMethod: r.paymentPreferenceMethod,
      };
    }),
    vouchers: voucherRows.map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      personType: v.personType,
      shirtSize: v.shirtSize,
      hasBreakfastKit: v.personType === "ADULT" ? Boolean(v.hasBreakfastKit) : false,
      customerName: v.reservation.customerNameSnapshot,
      packageName: v.reservation.package.name,
      packageDepartureDate: v.reservation.package.departureDate.toISOString().slice(0, 10),
      reservationId: v.reservationId,
      reservedAt: v.reservation.reservedAt.toISOString(),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      paidAt: p.paidAt.toISOString(),
      amount: money(p.amount),
      method: p.method,
      note: p.note,
      customerName: p.reservation.customerNameSnapshot,
      packageName: p.reservation.package.name,
      reservationId: p.reservation.id,
    })),
    overdue: overdueInstallments.map((i) => ({
      id: i.id,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      amount: money(i.amount),
      customerName: i.reservation.customerNameSnapshot,
      customerPhone: i.reservation.customerPhoneSnapshot,
      packageName: i.reservation.package.name,
      reservationId: i.reservation.id,
      paymentStatus: i.reservation.paymentStatus,
      totalDue: money(i.reservation.totalDue),
      totalPaid: money(i.reservation.totalPaid),
    })),
  };
}

export function formatBrl(value: string): string {
  return (Number.parseFloat(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTimeBr(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}
