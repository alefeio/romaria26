import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";
import { getAppUrl } from "@/lib/email";
import { getEmailBranding, wrapBrandedEmail } from "@/lib/email/branding";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { prisma } from "@/lib/prisma";

export type PartialPaymentEmailInput = {
  amount: Prisma.Decimal | string | number;
  method: string;
  paidAt: Date;
};

function formatBrl(value: Prisma.Decimal | string | number): string {
  const n = Number.parseFloat(String(value));
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPaymentMethodLabel(method: string): string {
  const key = method.trim().toUpperCase();
  const labels: Record<string, string> = {
    PIX: "Pix",
    CASH: "Dinheiro",
    DINHEIRO: "Dinheiro",
    CARD: "Cartão",
    CARTAO: "Cartão",
    TRANSFER: "Transferência",
    TRANSFERENCIA: "Transferência",
    OTHER: "Outro",
    OUTRO: "Outro",
  };
  return labels[key] ?? method;
}

function formatDateTimeBr(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Envia e-mail ao cliente quando um pagamento deixa a reserva com status PARTIAL.
 * Informa quanto foi pago neste lançamento, o total já pago e o saldo pendente.
 */
export async function sendReservationPartialPaymentCustomerEmail(
  reservationId: string,
  payment: PartialPaymentEmailInput,
  performedByUserId?: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      paymentStatus: true,
      totalDue: true,
      totalPaid: true,
      customerEmailSnapshot: true,
      customerNameSnapshot: true,
      package: { select: { name: true, departureDate: true, departureTime: true } },
    },
  });

  if (!reservation) return { ok: false, reason: "NOT_FOUND" };
  if (reservation.paymentStatus !== "PARTIAL") return { ok: false, reason: "NOT_PARTIAL" };

  const customerEmail = reservation.customerEmailSnapshot?.trim() ?? "";
  if (!customerEmail || isCustomerPlaceholderEmail(customerEmail)) {
    return { ok: false, reason: "NO_CUSTOMER_EMAIL" };
  }

  const totalDue = reservation.totalDue;
  const totalPaid = reservation.totalPaid;
  const pending = totalDue.sub(totalPaid);
  const paymentAmount = new Prisma.Decimal(payment.amount.toString());

  const pkgWhen = `${reservation.package.name} (${reservation.package.departureDate.toISOString().slice(0, 10)} às ${reservation.package.departureTime})`;
  const customerName = escapeHtml(reservation.customerNameSnapshot?.trim() || "Cliente");
  const branding = await getEmailBranding();
  const reservationsUrl = getAppUrl("/cliente/reservas");

  const bodyHtml = `
    <h2 style="margin:0 0 6px; font-size: 18px;">Pagamento recebido</h2>
    <p style="margin:0 0 14px; color:#374151; font-size: 14px;">
      Olá, <strong>${customerName}</strong>! Registramos um pagamento parcial da sua reserva.
      Ainda há saldo pendente para quitar o valor total.
    </p>
    <div style="margin: 0 0 16px; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color:#6b7280; margin-bottom: 8px;">Passeio</div>
      <div style="font-size: 14px; color: #111827;">${escapeHtml(pkgWhen)}</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Valor deste pagamento</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #111827;">${formatBrl(paymentAmount)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Forma de pagamento</td>
        <td style="padding: 8px 0; text-align: right; color: #111827;">${escapeHtml(formatPaymentMethodLabel(payment.method))}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Data do pagamento</td>
        <td style="padding: 8px 0; text-align: right; color: #111827;">${escapeHtml(formatDateTimeBr(payment.paidAt))}</td>
      </tr>
      <tr><td colspan="2" style="padding: 8px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;" /></td></tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Total já pago</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #047857;">${formatBrl(totalPaid)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Valor total da reserva</td>
        <td style="padding: 8px 0; text-align: right; color: #111827;">${formatBrl(totalDue)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Saldo pendente</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #b45309;">${formatBrl(pending)}</td>
      </tr>
    </table>
    <p style="margin: 18px 0 0; font-size: 14px; color: #374151;">
      Você pode acompanhar sua reserva e o status dos pagamentos em
      <a href="${reservationsUrl}" style="color: #2563eb; text-decoration: underline;">Minhas reservas</a>.
    </p>
    <p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">
      Os vouchers com QR Code serão enviados automaticamente quando o pagamento estiver 100% quitado.
    </p>
  `;

  const html = wrapBrandedEmail({
    logoUrl: branding.logoUrl,
    siteName: branding.siteName,
    bodyHtml,
  });

  const subject = `Pagamento recebido — saldo pendente ${formatBrl(pending)}`;

  const result = await sendEmailAndRecord({
    to: customerEmail,
    subject,
    html,
    emailType: "RESERVATION_PARTIAL_PAYMENT_CUSTOMER",
    entityType: "Reservation",
    entityId: reservationId,
    performedByUserId,
  });

  if (!result.success) {
    console.error("[partial-payment-email] falha ao enviar", reservationId, result.error);
    return { ok: false, reason: "SEND_FAILED" };
  }

  return { ok: true };
}
