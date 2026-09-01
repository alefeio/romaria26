import "server-only";

import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/email";
import type { SendEmailAttachment } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { getEmailBranding, wrapBrandedEmail } from "@/lib/email/branding";
import {
  allocateNextVoucherCode,
  linkVoucherCodeLedger,
  VOUCHER_RANGES,
} from "@/lib/vouchers/reservation-vouchers";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf("base64,");
  return i >= 0 ? dataUrl.slice(i + "base64,".length) : dataUrl;
}

export async function sendCollaboratorVoucherEmail(
  collaboratorId: string,
  performedByUserId?: string | null
): Promise<{ ok: true } | { ok: false; reason: string; error?: string }> {
  const row = await prisma.eventCollaborator.findFirst({
    where: { id: collaboratorId, voidedAt: null },
    include: {
      package: {
        select: {
          name: true,
          departureDate: true,
          departureTime: true,
          boardingLocation: true,
        },
      },
    },
  });
  if (!row) return { ok: false, reason: "NOT_FOUND" };

  const email = row.email.trim();
  if (!email) return { ok: false, reason: "NO_EMAIL" };

  const publicUrl = await resolvePublicAppUrl();
  const viewUrl = `${publicUrl}/voucher/${encodeURIComponent(row.code)}`;
  const checkinUrl = `${publicUrl}/admin/vouchers/${encodeURIComponent(row.code)}/checkin`;
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, { margin: 1, scale: 6 });
  const contentId = `collab-qr-${row.code}`;
  const attachments: SendEmailAttachment[] = [
    {
      filename: `qr-${row.code}.png`,
      content: dataUrlToBase64(qrDataUrl),
      contentId,
      contentType: "image/png",
    },
  ];

  const when = `${row.package.name} (${row.package.departureDate.toISOString().slice(0, 10)} às ${row.package.departureTime})`;
  const branding = await getEmailBranding();

  const roleLine = row.roleLabel?.trim()
    ? `<div><strong>Função:</strong> ${escapeHtml(row.roleLabel.trim())}</div>`
    : "";
  const shirtLine = row.shirtSize?.trim()
    ? `<div><strong>Camisa:</strong> ${escapeHtml(row.shirtSize.trim())}</div>`
    : "";

  const bodyHtml = `
    <h2 style="margin:0 0 8px 0; font-size: 18px;">Voucher de colaborador — ${escapeHtml(row.package.name)}</h2>
    <p style="margin:0 0 14px; color:#374151; font-size: 14px;">
      Olá, <strong>${escapeHtml(row.name)}</strong>! Segue seu voucher de equipe para o evento.
      Apresente o QR Code na entrada.
    </p>
    <div style="margin: 0 0 16px; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 14px;">
      <div><strong>Passeio:</strong> ${escapeHtml(when)}</div>
      <div><strong>Embarque:</strong> ${escapeHtml(row.package.boardingLocation)}</div>
      ${roleLine}
      ${shirtLine}
      <div style="margin-top:8px;"><strong>Número do voucher:</strong> <span style="font-family: monospace;">${escapeHtml(row.code)}</span></div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align: top; padding-right: 12px;">
          <p style="margin:0; font-size: 13px; color:#374151;">
            Link do voucher: <a href="${viewUrl}" style="color:#2563eb;">${viewUrl}</a>
          </p>
          <p style="margin:12px 0 0; font-size: 12px; color:#6b7280;">
            Este voucher é exclusivo para colaboradores da equipe (faixa ${VOUCHER_RANGES.COLLABORATOR.from}–${VOUCHER_RANGES.COLLABORATOR.to}).
          </p>
        </td>
        <td style="vertical-align: top; width: 170px; text-align: center;">
          <img src="cid:${contentId}" alt="QR Code ${escapeHtml(row.code)}" width="160" height="160" style="width:160px; height:160px; background:#fff; border:1px solid #e5e7eb; border-radius:12px; display:block;" />
        </td>
      </tr>
    </table>
  `;

  const html = wrapBrandedEmail({
    logoUrl: branding.logoUrl,
    siteName: branding.siteName,
    bodyHtml,
  });

  const result = await sendEmailAndRecord({
    to: email,
    subject: `Voucher de colaborador — ${row.package.name} (${row.code})`,
    html,
    attachments,
    emailType: "COLLABORATOR_VOUCHER",
    entityType: "EventCollaborator",
    entityId: row.id,
    performedByUserId,
  });

  if (!result.success) {
    return { ok: false, reason: "EMAIL_FAILED", error: result.error };
  }

  await prisma.eventCollaborator.update({
    where: { id: row.id },
    data: { emailedAt: new Date() },
  });

  return { ok: true };
}

export type CreateCollaboratorInput = {
  packageId: string;
  name: string;
  email: string;
  phone?: string | null;
  roleLabel?: string | null;
  shirtSize?: string | null;
  notes?: string | null;
};

export async function createEventCollaborator(
  input: CreateCollaboratorInput,
  performedByUserId?: string | null
) {
  const pkg = await prisma.package.findUnique({
    where: { id: input.packageId },
    select: { id: true, isActive: true },
  });
  if (!pkg) return { err: "PACKAGE_NOT_FOUND" as const };

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  const created = await prisma.$transaction(async (tx) => {
    const { codeNumber, code } = await allocateNextVoucherCode(tx, VOUCHER_RANGES.COLLABORATOR);

    const row = await tx.eventCollaborator.create({
      data: {
        packageId: input.packageId,
        name,
        email,
        phone: input.phone?.trim() || null,
        roleLabel: input.roleLabel?.trim() || null,
        shirtSize: input.shirtSize?.trim() || null,
        notes: input.notes?.trim() || null,
        codeNumber,
        code,
        createdByUserId: performedByUserId ?? null,
      },
      include: {
        package: { select: { name: true } },
      },
    });

    await linkVoucherCodeLedger(tx, codeNumber, { collaboratorId: row.id });

    return row;
  });

  const emailResult = await sendCollaboratorVoucherEmail(created.id, performedByUserId);
  if (!emailResult.ok) {
    return {
      ok: created,
      emailWarning: emailResult.reason === "EMAIL_FAILED" ? emailResult.error : emailResult.reason,
    };
  }

  return { ok: created };
}
