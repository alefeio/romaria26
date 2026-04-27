import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const createSchema = z.object({
  yearId: z.string().uuid(),
  imageUrl: z.string().trim().url(),
  caption: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const { searchParams } = new URL(request.url);
  const yearId = searchParams.get("yearId") ?? "";
  if (!z.string().uuid().safeParse(yearId).success) {
    return jsonErr("VALIDATION_ERROR", "yearId inválido.", 400);
  }
  const items = await prisma.siteGalleryPhoto.findMany({
    where: { yearId },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const maxOrder = await prisma.siteGalleryPhoto.aggregate({
    where: { yearId: parsed.data.yearId },
    _max: { order: true },
  });

  const item = await prisma.siteGalleryPhoto.create({
    data: {
      yearId: parsed.data.yearId,
      imageUrl: parsed.data.imageUrl,
      caption: parsed.data.caption ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return jsonOk({ item }, { status: 201 });
}

