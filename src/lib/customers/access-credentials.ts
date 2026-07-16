import "server-only";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { generateTempPassword } from "@/lib/password";
import { isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";

export type CustomerAccessCredentials = {
  userId: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
  /** Senha em texto só quando `mustChangePassword` e acabamos de (re)gerar. */
  temporaryPassword: string | null;
};

/**
 * Se o cliente ainda precisa definir a 1ª senha (`mustChangePassword`),
 * gera uma nova senha temporária, persiste o hash e devolve o texto para e-mail.
 * Caso contrário, devolve credenciais sem senha.
 */
export async function ensureTempPasswordForPendingFirstLogin(
  userId: string
): Promise<CustomerAccessCredentials | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, mustChangePassword: true, role: true },
  });
  if (!user || user.role !== "CUSTOMER") return null;

  if (!user.mustChangePassword) {
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      mustChangePassword: false,
      temporaryPassword: null,
    };
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true },
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    mustChangePassword: true,
    temporaryPassword,
  };
}

export function canEmailCustomerAccess(email: string): boolean {
  const e = email.trim();
  return e.length > 0 && !isCustomerPlaceholderEmail(e);
}

export function buildCustomerAccessBlockHtml(params: {
  loginUrl: string;
  resetUrl: string;
  accessEmail: string;
  temporaryPassword?: string | null;
}): string {
  const { loginUrl, resetUrl, accessEmail, temporaryPassword } = params;
  const escape = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const tempLine =
    temporaryPassword && temporaryPassword.length > 0
      ? `<div style="margin-top:8px;"><strong>Senha temporária:</strong> <code style="background:#fff;border:1px solid #e5e7eb;padding:2px 8px;border-radius:4px;font-size:13px;">${escape(temporaryPassword)}</code></div>
         <div style="margin-top:6px;font-size:12px;color:#6b7280;">No primeiro acesso você será solicitado a criar uma nova senha.</div>`
      : `<div style="margin-top:8px; font-size: 12px; color:#6b7280;">Entre com o <strong>e-mail cadastrado e sua senha</strong>. Se esquecer a senha, redefina em: <a href="${escape(resetUrl)}">${escape(resetUrl)}</a></div>`;

  return `
      <div style="margin: 14px 0 0; padding: 14px; border:1px solid #e5e7eb; border-radius: 12px; background:#f9fafb;">
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">Acompanhar sua reserva</div>
        <div style="font-size: 13px; color:#111827;">
          <div><strong>Área do cliente:</strong> <a href="${escape(loginUrl)}">${escape(loginUrl)}</a></div>
          <div><strong>E-mail de acesso:</strong> ${escape(accessEmail)}</div>
          ${tempLine}
        </div>
      </div>
    `;
}
