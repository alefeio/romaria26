import "server-only";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";
import { isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import {
  createReservationInTransaction,
  ReservationCreateError,
} from "@/lib/reservations/create-reservation";
import { adminCreateReservationForCustomerSchema } from "@/lib/validators/admin-reservation-create";

function buildWhatsAppHref(contactWhatsapp: string | null | undefined, text: string): string | null {
  const digits = (contactWhatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : "55" + digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const packageId = searchParams.get("packageId");

  const where: {
    status?: "PENDING" | "CONFIRMED" | "CANCELLED";
    packageId?: string;
  } = {};
  if (status === "PENDING" || status === "CONFIRMED" || status === "CANCELLED") {
    where.status = status;
  }
  if (packageId && /^[0-9a-f-]{36}$/i.test(packageId)) {
    where.packageId = packageId;
  }

  const rows = await prisma.reservation.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: [{ reservedAt: "desc" }],
    take: 400,
    include: {
      user: { select: { id: true, name: true, email: true } },
      package: { select: { id: true, name: true, slug: true, departureDate: true } },
    },
  });

  return jsonOk({
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      packageId: r.packageId,
      customerNameSnapshot: r.customerNameSnapshot,
      customerEmailSnapshot: r.customerEmailSnapshot,
      customerPhoneSnapshot: r.customerPhoneSnapshot,
      quantity: r.quantity,
      includesBreakfastKit: r.includesBreakfastKit,
      unitPriceSnapshot: r.unitPriceSnapshot.toString(),
      breakfastKitUnitPriceSnapshot: r.breakfastKitUnitPriceSnapshot.toString(),
      totalPrice: r.totalPrice.toString(),
      status: r.status,
      notes: r.notes,
      reservedAt: r.reservedAt.toISOString(),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      package: {
        ...r.package,
        departureDate: r.package.departureDate.toISOString().slice(0, 10),
      },
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = adminCreateReservationForCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const d = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: d.userId },
    select: { id: true, role: true, isActive: true, name: true, email: true },
  });
  if (!target || target.role !== "CUSTOMER") {
    return jsonErr("INVALID_CUSTOMER", "Cliente não encontrado ou inválido.", 404);
  }
  if (!target.isActive) {
    return jsonErr("INACTIVE_CUSTOMER", "O cliente está inativo.", 400);
  }

  try {
    const reservation = await createReservationInTransaction({
      packageId: d.packageId,
      userId: d.userId,
      quantity: d.quantity,
      adultsCount: d.adultsCount,
      childrenCount: d.childrenCount,
      adultNames: d.adultNames.map((s) => String(s ?? "")),
      adultShirtSizes: d.adultShirtSizes.map((s) => String(s ?? "")),
      childrenNames: d.childrenNames.map((s) => String(s ?? "")),
      childrenAges: d.childrenAges.map((n) => (typeof n === "number" ? n : Number(n))),
      childrenShirtNumbers: d.childrenShirtNumbers.map((n) => (typeof n === "number" ? n : Number(n))),
      breakfastSelections: d.breakfastSelections.map((v) => Boolean(v)),
      breakfastKitSelections: d.breakfastKitSelections.map((v) => Boolean(v)),
      paymentPreferenceMethod: d.paymentPreferenceMethod ?? null,
      paymentPreferenceInstallments: d.paymentPreferenceInstallments ?? null,
      customerNameSnapshot: d.customerNameSnapshot,
      customerEmailSnapshot: d.customerEmailSnapshot,
      customerPhoneSnapshot: d.customerPhoneSnapshot,
      notes: d.notes ?? null,
      initialStatus: d.initialStatus,
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
      `Reserva (painel) — ${siteName}`,
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

    const subject = `Reserva (painel) — ${pkg?.name ?? "Passeio"} (${reservation.quantity} pessoa(s))`;
    const html = `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap; line-height: 1.4">${summaryText.replace(
      /</g,
      "&lt;"
    )}</pre>`;

    const adminTo = adminUsers.map((u) => u.email).filter(Boolean);
    const customerEmail = reservation.customerEmailSnapshot.trim();
    const sendToCustomer = customerEmail.length > 0 && !isCustomerPlaceholderEmail(customerEmail);

    await Promise.allSettled([
      sendToCustomer
        ? sendEmailAndRecord({
            to: customerEmail,
            subject,
            html,
            emailType: "RESERVATION_CREATED_CUSTOMER",
            entityType: "Reservation",
            entityId: reservation.id,
            performedByUserId: auth.id,
          })
        : Promise.resolve(),
      adminTo.length
        ? sendEmailAndRecord({
            to: adminTo,
            subject: `[ADMIN] ${subject}`,
            html,
            emailType: "RESERVATION_CREATED_ADMIN",
            entityType: "Reservation",
            entityId: reservation.id,
            performedByUserId: auth.id,
          })
        : Promise.resolve(),
    ]);

    await createAuditLog({
      entityType: "Reservation",
      entityId: reservation.id,
      action: "RESERVATION_CREATED_BY_ADMIN",
      diff: { userId: d.userId, packageId: d.packageId, customerUser: target.name },
      performedByUserId: auth.id,
    });

    return jsonOk(
      { reservation: { id: reservation.id }, whatsappUrl: whatsappUrl ?? undefined },
      { status: 201 }
    );
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
