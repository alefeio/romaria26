import "server-only";

import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  createReservationInTransaction,
  ReservationCreateError,
} from "@/lib/reservations/create-reservation";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";

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
      status: r.status,
      notes: r.notes,
      kitsDeliveryInfoSnapshot: r.kitsDeliveryInfoSnapshot ?? null,
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
  const adultShirtSizes = Array.isArray(o.adultShirtSizes) ? o.adultShirtSizes : [];
  const childrenShirtNumbers = Array.isArray(o.childrenShirtNumbers) ? o.childrenShirtNumbers : [];
  const breakfastSelections = Array.isArray(o.breakfastSelections) ? o.breakfastSelections : [];
  const breakfastKitSelections = Array.isArray(o.breakfastKitSelections) ? o.breakfastKitSelections : [];
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
      adultShirtSizes: adultShirtSizes.map((s) => String(s ?? "")),
      childrenShirtNumbers: childrenShirtNumbers.map((n) => (typeof n === "number" ? n : Number(n))),
      breakfastSelections: breakfastSelections.map((v) => Boolean(v)),
      breakfastKitSelections: breakfastKitSelections.map((v) => Boolean(v)),
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
    const breakfastCount = reservation.breakfastSelections.filter(Boolean).length;

    const kitInfo = reservation.kitsDeliveryInfoSnapshot?.trim();
    const siteName = settings?.siteName ?? "Romaria Fluvial";

    const summaryText = [
      `Reserva — ${siteName}`,
      pkgLine,
      `Embarque: ${pkg?.boardingLocation ?? "-"}`,
      `Adultos: ${reservation.adultsCount} | Crianças: ${reservation.childrenCount} | Total: ${reservation.quantity}`,
      `Camisas adultos: ${adultSizesLine}`,
      `Camisas crianças (idade/número): ${childNumsLine}`,
      `Café da manhã (marcados): ${breakfastCount}/${reservation.quantity}`,
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
    const html = `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap; line-height: 1.4">${summaryText.replace(
      /</g,
      "&lt;"
    )}</pre>`;

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
