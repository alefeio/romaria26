import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const createSchema = z.object({
  year: z.number().int().min(1900).max(3000),
  title: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.siteGalleryYear.findMany({
    orderBy: [{ year: "desc" }],
    include: { _count: { select: { photos: true } } },
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

  try {
    const item = await prisma.siteGalleryYear.create({
      data: {
        year: parsed.data.year,
        title: parsed.data.title ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return jsonOk({ item }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar ano.";
    return jsonErr("CREATE_ERROR", msg, 400);
  }
}

