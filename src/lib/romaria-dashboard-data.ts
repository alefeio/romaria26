import "server-only";

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

export async function getRomariaAdminDashboard(): Promise<{
  packagesOpen: number;
  packagesTotal: number;
  reservationsPending: number;
  reservationsTotal: number;
  paymentsDueToday: number;
  recentReservations: RomariaRecentReservation[];
}> {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(today + "T00:00:00.000Z");
  const end = new Date(today + "T23:59:59.999Z");

  const [packagesOpen, packagesTotal, reservationsPending, reservationsTotal, paymentsDueToday, recentRaw] = await Promise.all([
    prisma.package.count({ where: { isActive: true, status: "OPEN" } }),
    prisma.package.count(),
    prisma.reservation.count({ where: { status: "PENDING" } }),
    prisma.reservation.count(),
    prisma.reservationInstallment.count({ where: { status: "SCHEDULED", dueDate: { gte: start, lte: end } } }),
    prisma.reservation.findMany({
      take: 10,
      orderBy: { reservedAt: "desc" },
      include: {
        package: { select: { name: true, slug: true } },
        user: { select: { email: true } },
      },
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

  return {
    packagesOpen,
    packagesTotal,
    reservationsPending,
    reservationsTotal,
    paymentsDueToday,
    recentReservations,
  };
}
