import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSessionUser, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { resolvePublicAppUrl } from "@/lib/email";
import { generateTempPassword } from "@/lib/password";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await requireSessionUser().catch(() => null);
  if (!user) return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);

  const { code } = await params;
  const c = decodeURIComponent(code ?? "").trim();
  if (!c) return jsonErr("VALIDATION_ERROR", "Código inválido.", 400);

  const v = await prisma.reservationVoucher.findFirst({
    where: { code: c },
    include: { reservation: { select: { userId: true } } },
  });
  if (!v) return jsonErr("NOT_FOUND", "Voucher não encontrado.", 404);

  // Cliente só pode compartilhar o próprio voucher; admin/master pode compartilhar qualquer um.
  if (user.role === "CUSTOMER" && v.reservation.userId !== user.id) {
    return jsonErr("FORBIDDEN", "Você não pode compartilhar um voucher de outra conta.", 403);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 dias

  const share = await prisma.reservationVoucherShare.create({
    data: {
      voucherId: v.id,
      passwordHash,
      expiresAt,
      createdByUserId: user.id,
    },
    select: { id: true, expiresAt: true, createdAt: true },
  });

  const base = await resolvePublicAppUrl();
  const viewUrl = `${base}/voucher/${encodeURIComponent(v.code)}`;
  const accessUrl = `${viewUrl}?s=${encodeURIComponent(share.id)}&p=${encodeURIComponent(tempPassword)}`;

  return jsonOk({
    shareId: share.id,
    expiresAt: share.expiresAt.toISOString(),
    accessUrl,
    viewUrl,
    tempPassword,
  });
}

