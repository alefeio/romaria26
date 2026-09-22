import { prisma } from "@/lib/prisma";
import { requireSellerApi } from "@/lib/api-admin-guard";
import { jsonOk } from "@/lib/http";
import { getPackageRemainingCapacity } from "@/lib/reservations/create-reservation";
import { formatDateOnly } from "@/lib/format";

export async function GET() {
  const auth = await requireSellerApi();
  if (auth instanceof Response) return auth;

  const packages = await prisma.package.findMany({
    where: { isActive: true, status: "OPEN" },
    orderBy: [{ departureDate: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      childPrice: true,
      breakfastKitAvailable: true,
      breakfastKitPrice: true,
      kitsDeliveryInfo: true,
      departureDate: true,
      departureTime: true,
      boardingLocation: true,
      capacity: true,
    },
  });

  const items = [];
  for (const p of packages) {
    const remaining = await getPackageRemainingCapacity(p.id);
    if (remaining == null || remaining <= 0) continue;
    items.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price.toString(),
      childPrice: p.childPrice.toString(),
      breakfastKitAvailable: p.breakfastKitAvailable,
      breakfastKitPrice: p.breakfastKitPrice.toString(),
      kitsDeliveryInfo: p.kitsDeliveryInfo,
      departureDate: p.departureDate.toISOString().slice(0, 10),
      departureDateLabel: formatDateOnly(p.departureDate),
      departureTime: p.departureTime,
      boardingLocation: p.boardingLocation,
      remainingPlaces: remaining,
    });
  }

  return jsonOk({ items });
}
