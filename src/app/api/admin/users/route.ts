import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAdminSchema } from "@/lib/validators/users";
import { createAuditLog } from "@/lib/audit";
import { generateTempPassword } from "@/lib/password";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateAdminWelcome } from "@/lib/email/templates";
import { createAdminWelcomeCopyToken } from "@/lib/admin-welcome-copy-token";
import { resolvePublicAppUrl } from "@/lib/email";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);

  const users = await prisma.user.findMany({
    where: { OR: [{ role: "ADMIN" }, { role: "MASTER" }, { role: "SELLER" }, { isAdmin: true }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isAdmin: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return jsonOk({ users });
}

export async function POST(request: Request) {
  const actor = await requireRole(["ADMIN", "MASTER"]);

  const body = await request.json().catch(() => null);
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { name, email, role } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, isActive: true, isAdmin: true },
  });

  if (existing) {
    if (existing.role === "ADMIN" || existing.role === "MASTER" || existing.role === "SELLER") {
      return jsonErr("EMAIL_IN_USE", "Já existe um usuário interno com este e-mail.", 409);
    }
    if (existing.role === "CUSTOMER") {
      if (role === "SELLER") {
        return jsonErr("EMAIL_IN_USE", "Este e-mail já pertence a um cliente. Use outro e-mail para a vendedora.", 409);
      }
      if (existing.isAdmin) {
        return jsonErr("EMAIL_IN_USE", "Este usuário já possui acesso como Admin.", 409);
      }
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { isAdmin: true, ...(name.trim() !== existing.name ? { name: name.trim() } : {}) },
        select: { id: true, name: true, email: true, role: true, isAdmin: true, isActive: true },
      });
      await createAuditLog({
        entityType: "User",
        entityId: updated.id,
        action: "ADMIN_ACCESS_GRANTED",
        diff: { email: updated.email, previousRole: existing.role },
        performedByUserId: actor.id,
      });
      return jsonOk(
        {
          user: updated,
          emailSent: true,
          alreadyRegisteredAs: "Cliente",
        },
        { status: 200 }
      );
    }
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const createdRole = role === "SELLER" ? ("SELLER" as const) : ("ADMIN" as const);
  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: createdRole,
      isActive: true,
      mustChangePassword: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "USER_CREATED",
    diff: { created: { id: created.id, email: created.email, role: created.role } },
    performedByUserId: actor.id,
  });

  const base = await resolvePublicAppUrl();
  const loginUrl = `${base}/login`;
  const copyToken = await createAdminWelcomeCopyToken({
    email: created.email,
    tempPassword,
  });
  const copyPasswordUrl = `${base}/admin/copiar-acesso?t=${encodeURIComponent(copyToken)}`;

  const { subject, html } = templateAdminWelcome({
    name: created.name,
    email: created.email,
    tempPassword,
    loginUrl,
    copyPasswordUrl,
    role: createdRole,
  });

  const emailType = createdRole === "SELLER" ? "welcome_seller" : "welcome_admin";
  const emailParams = {
    to: created.email,
    subject,
    html,
    emailType,
    entityType: "User" as const,
    entityId: created.id,
    performedByUserId: actor.id,
  };
  let emailResult = await sendEmailAndRecord(emailParams);
  if (!emailResult.success) {
    await new Promise((r) => setTimeout(r, 1500));
    emailResult = await sendEmailAndRecord(emailParams);
  }
  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "EMAIL_SENT",
    diff: { type: emailType, success: emailResult.success, messageId: emailResult.messageId },
    performedByUserId: actor.id,
  });

  return jsonOk(
    {
      user: created,
      emailSent: emailResult.success,
      // Sempre devolve a senha ao criador para ele entregar se o e-mail falhar (ou confirmar o envio).
      temporaryPassword: tempPassword,
      loginUrl,
    },
    { status: 201 }
  );
}
