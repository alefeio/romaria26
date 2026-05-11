import "server-only";

import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  createReservationInTransaction,
  ReservationCreateError,
} from "@/lib/reservations/create-reservation";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { getEmailBranding, wrapBrandedEmail } from "@/lib/email/branding";
import { generateTempPassword } from "@/lib/password";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET() {
  const session = await getSessionUserFromCookie();
  if (!session) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const rows = await prisma.reservation.findMany({
    where: { userId: session.id },
    orderBy: [{ reservedAt: "desc" }],
    include: {
      package: {
        select: {
          id: true,
          name: true,
          slug: true,
          departureDate: true,
          departureTime: true,
          boardingLocation: true,
        },
      },
      vouchers: {
        orderBy: [{ personType: "asc" }, { personIndex: "asc" }],
        select: {
          id: true,
          code: true,
          personType: true,
          personIndex: true,
          name: true,
          age: true,
          shirtSize: true,
          hasBreakfastKit: true,
          usedAt: true,
        },
      },
    },
  });

  return jsonOk({
    items: rows.map((r) => ({
      id: r.id,
      packageId: r.packageId,
      customerNameSnapshot: r.customerNameSnapshot,
      customerEmailSnapshot: r.customerEmailSnapshot,
      customerPhoneSnapshot: r.customerPhoneSnapshot,
      quantity: r.quantity,
      adultsCount: r.adultsCount,
      childrenCount: r.childrenCount,
      adultShirtSizes: r.adultShirtSizes,
      childrenShirtNumbers: r.childrenShirtNumbers,
      breakfastSelections: r.breakfastSelections,
      breakfastKitSelections: r.breakfastKitSelections,
      includesBreakfastKit: r.includesBreakfastKit,
      totalPrice: r.totalPrice.toString(),
      paymentStatus: r.paymentStatus,
      status: r.status,
      notes: r.notes,
      kitsDeliveryInfoSnapshot: r.kitsDeliveryInfoSnapshot ?? null,
      vouchers: r.vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        personType: v.personType,
        personIndex: v.personIndex,
        name: v.name,
        age: v.age ?? null,
        shirtSize: v.shirtSize,
        hasBreakfastKit: v.hasBreakfastKit,
        usedAt: v.usedAt?.toISOString() ?? null,
      })),
      reservedAt: r.reservedAt.toISOString(),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      package: {
        ...r.package,
        departureDate: r.package.departureDate.toISOString().slice(0, 10),
      },
    })),
  });
}

function buildWhatsAppHref(contactWhatsapp: string | null | undefined, text: string): string | null {
  const digits = (contactWhatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : "55" + digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

/**
 * Cria reserva para o usuário autenticado.
 * Valida kit café e capacidade dentro de transação com bloqueio do pacote.
 */
export async function POST(request: Request) {
  const session = await getSessionUserFromCookie();
  if (!session) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("INVALID_JSON", "Corpo da requisição inválido.", 400);
  }

  if (body === null || typeof body !== "object") {
    return jsonErr("INVALID_BODY", "Payload inválido.", 400);
  }

  const o = body as Record<string, unknown>;
  const packageId = typeof o.packageId === "string" ? o.packageId : "";
  const quantity = typeof o.quantity === "number" ? o.quantity : Number.NaN;
  const adultsCount = typeof o.adultsCount === "number" ? o.adultsCount : Number.NaN;
  const childrenCount = typeof o.childrenCount === "number" ? o.childrenCount : Number.NaN;
  const adultNames = Array.isArray(o.adultNames) ? o.adultNames : [];
  const adultShirtSizes = Array.isArray(o.adultShirtSizes) ? o.adultShirtSizes : [];
  const childrenNames = Array.isArray(o.childrenNames) ? o.childrenNames : [];
  const childrenAges = Array.isArray(o.childrenAges) ? o.childrenAges : [];
  const childrenShirtNumbers = Array.isArray(o.childrenShirtNumbers) ? o.childrenShirtNumbers : [];
  const breakfastSelections = Array.isArray(o.breakfastSelections) ? o.breakfastSelections : [];
  const breakfastKitSelections = Array.isArray(o.breakfastKitSelections) ? o.breakfastKitSelections : [];
  const paymentPreferenceMethod =
    typeof o.paymentPreferenceMethod === "string" ? o.paymentPreferenceMethod : null;
  const paymentPreferenceInstallments =
    typeof o.paymentPreferenceInstallments === "number" ? o.paymentPreferenceInstallments : null;
  const customerNameSnapshot =
    typeof o.customerNameSnapshot === "string" ? o.customerNameSnapshot : "";
  const customerEmailSnapshot =
    typeof o.customerEmailSnapshot === "string" ? o.customerEmailSnapshot : "";
  const customerPhoneSnapshot =
    typeof o.customerPhoneSnapshot === "string" ? o.customerPhoneSnapshot : "";
  const notes = typeof o.notes === "string" ? o.notes : null;
  const initialStatus =
    o.initialStatus === "PENDING" || o.initialStatus === "CONFIRMED"
      ? o.initialStatus
      : undefined;

  try {
    const reservation = await createReservationInTransaction({
      packageId,
      userId: session.id,
      quantity,
      adultsCount,
      childrenCount,
      adultNames: adultNames.map((s) => String(s ?? "")),
      adultShirtSizes: adultShirtSizes.map((s) => String(s ?? "")),
      childrenNames: childrenNames.map((s) => String(s ?? "")),
      childrenAges: childrenAges.map((n) => (typeof n === "number" ? n : Number(n))),
      childrenShirtNumbers: childrenShirtNumbers.map((n) => (typeof n === "number" ? n : Number(n))),
      breakfastSelections: breakfastSelections.map((v) => Boolean(v)),
      breakfastKitSelections: breakfastKitSelections.map((v) => Boolean(v)),
      paymentPreferenceMethod,
      paymentPreferenceInstallments,
      customerNameSnapshot,
      customerEmailSnapshot,
      customerPhoneSnapshot,
      notes,
      initialStatus,
    });

    const [pkg, settings, adminUsers] = await Promise.all([
      prisma.package.findUnique({
        where: { id: reservation.packageId },
        select: { name: true, slug: true, departureDate: true, departureTime: true, boardingLocation: true },
      }),
      prisma.siteSettings.findFirst({ select: { contactWhatsapp: true, siteName: true } }),
      prisma.user.findMany({
        where: { isActive: true, OR: [{ role: { in: ["MASTER", "ADMIN"] } }, { isAdmin: true }] },
        select: { email: true },
      }),
    ]);

    const pkgLine = pkg
      ? `${pkg.name} (${pkg.departureDate.toISOString().slice(0, 10)} às ${pkg.departureTime})`
      : "Passeio";

    const adultSizesLine = reservation.adultShirtSizes.length
      ? reservation.adultShirtSizes.map((s, i) => `A${i + 1}:${s}`).join(", ")
      : "-";
    const childNumsLine = reservation.childrenShirtNumbers.length
      ? reservation.childrenShirtNumbers.map((n, i) => `C${i + 1}:${n}`).join(", ")
      : "-";
    const kitCount = reservation.breakfastKitSelections.filter(Boolean).length;

    const kitInfo = reservation.kitsDeliveryInfoSnapshot?.trim();
    const siteName = settings?.siteName ?? "Romaria Fluvial";

    const summaryText = [
      `Reserva — ${siteName}`,
      pkgLine,
      `Embarque: ${pkg?.boardingLocation ?? "-"}`,
      `Adultos: ${reservation.adultsCount} | Crianças: ${reservation.childrenCount} | Total: ${reservation.quantity}`,
      `Pagamento: ${reservation.paymentPreferenceMethod ?? "-"}` +
        (reservation.paymentPreferenceMethod === "CARTAO" && reservation.paymentPreferenceInstallments
          ? ` (${reservation.paymentPreferenceInstallments}x)`
          : ""),
      `Camisas adultos: ${adultSizesLine}`,
      `Camisas crianças (número/tamanho): ${childNumsLine}`,
      `Kit café (adultos marcados): ${kitCount}/${reservation.adultsCount}`,
      kitInfo ? `Entrega dos kits: ${kitInfo}` : null,
      `Cliente: ${reservation.customerNameSnapshot}`,
      `E-mail: ${reservation.customerEmailSnapshot}`,
      `WhatsApp: ${reservation.customerPhoneSnapshot}`,
      reservation.notes ? `Obs.: ${reservation.notes}` : null,
      `Reserva ID: ${reservation.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    const whatsappUrl = buildWhatsAppHref(settings?.contactWhatsapp, summaryText);

    const subject = `Reserva recebida — ${pkg?.name ?? "Passeio"} (${reservation.quantity} pessoa(s))`;
    const branding = await getEmailBranding();
    const loginUrl = branding.loginUrl;
    const resetUrl = branding.resetPasswordUrl;

    // Não é possível recuperar a senha atual. Para informar "senha" no e-mail,
    // geramos uma senha temporária e forçamos troca no primeiro acesso.
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash, mustChangePassword: true },
    });

    const pre = summaryText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const accessBlock = `
      <div style="margin: 14px 0 0; padding: 14px; border:1px solid #e5e7eb; border-radius: 12px; background:#f9fafb;">
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">Acesso à sua área do cliente</div>
        <div style="font-size: 13px; color:#111827;">
          <div><strong>Link:</strong> <a href="${loginUrl}">${loginUrl}</a></div>
          <div><strong>E-mail:</strong> ${escapeHtml(reservation.customerEmailSnapshot)}</div>
          <div><strong>Senha temporária:</strong> <code style="background:#fff; padding:2px 6px; border:1px solid #e5e7eb; border-radius:6px;">${escapeHtml(
            tempPassword
          )}</code></div>
          <div style="margin-top:6px; font-size: 12px; color:#6b7280;">Por segurança, você deverá trocar a senha no primeiro acesso.</div>
        </div>
      </div>
    `;

    const html = wrapBrandedEmail({
      logoUrl: branding.logoUrl,
      siteName: branding.siteName,
      bodyHtml: `
        <h2 style="margin:0 0 6px; font-size: 18px;">Reserva recebida</h2>
        <p style="margin:0 0 14px; color:#374151; font-size: 14px;">Recebemos sua reserva. Confira os detalhes abaixo.</p>
        ${accessBlock}
        <div style="margin-top: 16px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color:#6b7280; margin-bottom: 8px;">Detalhes da reserva</div>
          <pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap; line-height: 1.45; background:#fff; border:1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin:0;">${pre}</pre>
        </div>
      `,
    });

    const adminTo = adminUsers.map((u) => u.email).filter(Boolean);

    await Promise.allSettled([
      sendEmailAndRecord({
        to: reservation.customerEmailSnapshot,
        subject,
        html,
        emailType: "RESERVATION_CREATED_CUSTOMER",
        entityType: "Reservation",
        entityId: reservation.id,
        performedByUserId: session.id,
      }),
      adminTo.length
        ? sendEmailAndRecord({
            to: adminTo,
            subject: `[ADMIN] ${subject}`,
            html,
            emailType: "RESERVATION_CREATED_ADMIN",
            entityType: "Reservation",
            entityId: reservation.id,
            performedByUserId: session.id,
          })
        : Promise.resolve(),
    ]);

    return jsonOk({ reservation, whatsappUrl: whatsappUrl ?? undefined }, { status: 201 });
  } catch (e) {
    if (e instanceof ReservationCreateError) {
      const status =
        e.code === "INSUFFICIENT_CAPACITY"
          ? 409
          : e.code === "BREAKFAST_NOT_ALLOWED"
            ? 422
            : e.code === "PACKAGE_UNAVAILABLE"
              ? 404
              : 400;
      return jsonErr(e.code, e.message, status);
    }
    throw e;
  }
}
