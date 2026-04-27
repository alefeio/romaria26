import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { z } from "zod";

const patchSchema = z.object({
  caption: z.string().trim().max(200).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return jsonErr("VALIDATION_ERROR", "id inválido.", 400);
  }
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const item = await prisma.siteGalleryPhoto.update({
    where: { id },
    data: {
      caption: parsed.data.caption === undefined ? undefined : parsed.data.caption,
      order: parsed.data.order,
    },
  });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return jsonErr("VALIDATION_ERROR", "id inválido.", 400);
  }
  await prisma.siteGalleryPhoto.delete({ where: { id } });
  return jsonOk({ deleted: true });
}

