import "server-only";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { createVerificationToken } from "@/lib/verification-token";
import { getAppUrl } from "@/lib/email";
import { templatePasswordReset } from "@/lib/email/templates";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { createAuditLog } from "@/lib/audit";
import { isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/** Admin: envia e-mail de redefinição de senha para o cliente. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || user.role !== "CUSTOMER") {
    return jsonErr("NOT_FOUND", "Cliente não encontrado.", 404);
  }
  if (!user.isActive) {
    return jsonErr("INACTIVE", "O cliente está inativo.", 400);
  }
  if (isCustomerPlaceholderEmail(user.email)) {
    return jsonErr(
      "NO_EMAIL",
      "Este cliente ainda não tem um e-mail de contato válido. Informe um e-mail antes de enviar a redefinição.",
      400
    );
  }

  const { token } = await createVerificationToken({
    userId: user.id,
    type: "PASSWORD_RESET",
    expiresInDays: 1,
  });
  const resetUrl = getAppUrl(`/redefinir-senha?token=${encodeURIComponent(token)}`);
  const { subject, html } = templatePasswordReset({ name: user.name, resetUrl });

  const result = await sendEmailAndRecord({
    to: user.email,
    subject,
    html,
    emailType: "PASSWORD_RESET_ADMIN",
    entityType: "User",
    entityId: user.id,
    performedByUserId: auth.id,
  });

  await createAuditLog({
    entityType: "User",
    entityId: user.id,
    action: "PASSWORD_RESET_EMAIL_SENT",
    diff: { success: result.success, messageId: result.messageId ?? null },
    performedByUserId: auth.id,
  });

  if (!result.success) {
    return jsonErr("EMAIL_FAILED", result.error ?? "Falha ao enviar o e-mail de redefinição.", 502);
  }

  return jsonOk({ message: "E-mail de redefinição de senha enviado." });
}
