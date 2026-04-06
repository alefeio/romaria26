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
  recentReservations: RomariaRecentReservation[];
}> {
  const [packagesOpen, packagesTotal, reservationsPending, reservationsTotal, recentRaw] = await Promise.all([
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
    recentReservations,
  };
}
