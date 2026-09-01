import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";
import { sendCollaboratorVoucherEmail } from "@/lib/collaborators/collaborator-vouchers";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const existing = await prisma.eventCollaborator.findFirst({
    where: { id, voidedAt: null },
    select: { id: true, code: true, name: true, usedAt: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);

  const now = new Date();
  await prisma.eventCollaborator.update({
    where: { id },
    data: { voidedAt: now },
  });

  await createAuditLog({
    entityType: "EventCollaborator",
    entityId: id,
    action: "COLLABORATOR_VOIDED",
    diff: { code: existing.code, name: existing.name, wasUsed: Boolean(existing.usedAt) },
    performedByUserId: auth.id,
  }).catch(() => null);

  return jsonOk({ deleted: true });
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const result = await sendCollaboratorVoucherEmail(id, auth.id);
  if (!result.ok) {
    if (result.reason === "NOT_FOUND") return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);
    if (result.reason === "NO_EMAIL") return jsonErr("NO_EMAIL", "Colaborador sem e-mail válido.", 400);
    return jsonErr("EMAIL_FAILED", result.error ?? "Falha ao reenviar e-mail.", 502);
  }

  await createAuditLog({
    entityType: "EventCollaborator",
    entityId: id,
    action: "COLLABORATOR_VOUCHER_RESENT",
    diff: {},
    performedByUserId: auth.id,
  }).catch(() => null);

  return jsonOk({ ok: true });
}
