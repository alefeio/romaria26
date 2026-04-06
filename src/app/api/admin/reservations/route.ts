import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const packageId = searchParams.get("packageId");

  const where: {
    status?: "PENDING" | "CONFIRMED" | "CANCELLED";
    packageId?: string;
  } = {};
  if (status === "PENDING" || status === "CONFIRMED" || status === "CANCELLED") {
    where.status = status;
  }
  if (packageId && /^[0-9a-f-]{36}$/i.test(packageId)) {
    where.packageId = packageId;
  }

  const rows = await prisma.reservation.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: [{ reservedAt: "desc" }],
    take: 400,
    include: {
      user: { select: { id: true, name: true, email: true } },
      package: { select: { id: true, name: true, slug: true, departureDate: true } },
    },
  });

  return jsonOk({
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      packageId: r.packageId,
      customerNameSnapshot: r.customerNameSnapshot,
      customerEmailSnapshot: r.customerEmailSnapshot,
      customerPhoneSnapshot: r.customerPhoneSnapshot,
      quantity: r.quantity,
      includesBreakfastKit: r.includesBreakfastKit,
      unitPriceSnapshot: r.unitPriceSnapshot.toString(),
      breakfastKitUnitPriceSnapshot: r.breakfastKitUnitPriceSnapshot.toString(),
      totalPrice: r.totalPrice.toString(),
      status: r.status,
      notes: r.notes,
      reservedAt: r.reservedAt.toISOString(),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      package: {
        ...r.package,
        departureDate: r.package.departureDate.toISOString().slice(0, 10),
      },
    })),
  });
}
