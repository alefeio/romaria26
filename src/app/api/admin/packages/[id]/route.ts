import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminPackageUpdateSchema } from "@/lib/validators/packages";

function departureDateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const item = await prisma.package.findUnique({ where: { id } });
  if (!item) return jsonErr("NOT_FOUND", "Pacote não encontrado.", 404);

  return jsonOk({
    item: {
      ...item,
      price: item.price.toString(),
      childPrice: item.childPrice.toString(),
      breakfastKitPrice: item.breakfastKitPrice.toString(),
    },
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const existing = await prisma.package.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Pacote não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = adminPackageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;
  if (Object.keys(d).length === 0) {
    return jsonErr("VALIDATION_ERROR", "Nenhum campo para atualizar.", 400);
  }
  if (d.slug && d.slug !== existing.slug) {
    const slugTaken = await prisma.package.findUnique({ where: { slug: d.slug } });
    if (slugTaken) return jsonErr("SLUG_TAKEN", "Já existe um pacote com este slug.", 409);
  }

  try {
    const item = await prisma.package.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.slug !== undefined ? { slug: d.slug } : {}),
        ...(d.description !== undefined ? { description: d.description?.trim() || null } : {}),
        ...(d.shortDescription !== undefined ? { shortDescription: d.shortDescription?.trim() || null } : {}),
        ...(d.price !== undefined ? { price: new Prisma.Decimal(d.price) } : {}),
        ...(d.childPrice !== undefined ? { childPrice: new Prisma.Decimal(d.childPrice) } : {}),
        ...(d.breakfastKitAvailable !== undefined ? { breakfastKitAvailable: d.breakfastKitAvailable } : {}),
        ...(d.breakfastKitPrice !== undefined ? { breakfastKitPrice: new Prisma.Decimal(d.breakfastKitPrice) } : {}),
        ...(d.kitsDeliveryInfo !== undefined ? { kitsDeliveryInfo: d.kitsDeliveryInfo?.trim() || null } : {}),
        ...(d.departureDate !== undefined ? { departureDate: departureDateFromYmd(d.departureDate) } : {}),
        ...(d.departureTime !== undefined ? { departureTime: d.departureTime.trim() } : {}),
        ...(d.boardingLocation !== undefined ? { boardingLocation: d.boardingLocation.trim() } : {}),
        ...(d.capacity !== undefined ? { capacity: d.capacity } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.coverImageUrl !== undefined ? { coverImageUrl: d.coverImageUrl?.trim() || null } : {}),
        ...(d.galleryImages !== undefined ? { galleryImages: d.galleryImages } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    return jsonOk({
      item: {
        ...item,
        price: item.price.toString(),
        childPrice: item.childPrice.toString(),
        breakfastKitPrice: item.breakfastKitPrice.toString(),
      },
    });
  } catch (e) {
    console.error(e);
    return jsonErr("DB_ERROR", "Não foi possível atualizar o pacote.", 500);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const count = await prisma.reservation.count({ where: { packageId: id } });
  if (count > 0) {
    return jsonErr(
      "HAS_RESERVATIONS",
      "Não é possível excluir: existem reservas vinculadas a este pacote.",
      409
    );
  }

  try {
    await prisma.package.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch {
    return jsonErr("NOT_FOUND", "Pacote não encontrado.", 404);
  }
}
