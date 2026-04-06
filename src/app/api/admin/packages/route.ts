import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminPackageCreateSchema } from "@/lib/validators/packages";

function departureDateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const items = await prisma.package.findMany({
    orderBy: [{ departureDate: "asc" }, { name: "asc" }],
  });

  return jsonOk({
    items: items.map((p) => ({
      ...p,
      price: p.price.toString(),
      breakfastKitPrice: p.breakfastKitPrice.toString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = adminPackageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;
  const slugTaken = await prisma.package.findUnique({ where: { slug: d.slug } });
  if (slugTaken) {
    return jsonErr("SLUG_TAKEN", "Já existe um pacote com este slug.", 409);
  }

  const price = new Prisma.Decimal(d.price);
  const breakfastKitPrice = new Prisma.Decimal(d.breakfastKitPrice ?? "0");

  try {
    const item = await prisma.package.create({
      data: {
        name: d.name,
        slug: d.slug,
        description: d.description?.trim() || null,
        shortDescription: d.shortDescription?.trim() || null,
        price,
        breakfastKitAvailable: d.breakfastKitAvailable ?? false,
        breakfastKitPrice,
        departureDate: departureDateFromYmd(d.departureDate),
        departureTime: d.departureTime.trim(),
        boardingLocation: d.boardingLocation.trim(),
        capacity: d.capacity,
        status: d.status ?? "DRAFT",
        coverImageUrl: d.coverImageUrl?.trim() || null,
        galleryImages: d.galleryImages ?? [],
        isActive: d.isActive ?? true,
      },
    });
    return jsonOk(
      {
        item: {
          ...item,
          price: item.price.toString(),
          breakfastKitPrice: item.breakfastKitPrice.toString(),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
    return jsonErr("DB_ERROR", "Não foi possível criar o pacote.", 500);
  }
}
