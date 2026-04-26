import "server-only";

import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";
import { isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";
import { resolvePublicAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";

export const VOUCHER_RANGES = {
  ADULT_WITH_KIT: { from: 1, to: 1000 },
  ADULT_NO_KIT: { from: 1001, to: 2000 },
  CHILD: { from: 2001, to: 3000 },
} as const;

export function formatVoucherCode(n: number): string {
  return String(n).padStart(4, "0");
}

type TxClient = Parameters<typeof prisma.$transaction>[0] extends (arg: infer T) => any ? T : never;

async function allocateNextVoucherNumber(
  tx: TxClient,
  packageId: string,
  range: { from: number; to: number }
): Promise<number> {
  const maxRow = await tx.reservationVoucher.aggregate({
    where: { packageId, codeNumber: { gte: range.from, lte: range.to } },
    _max: { codeNumber: true },
  });
  const next = (maxRow._max.codeNumber ?? range.from - 1) + 1;
  if (next > range.to) {
    throw new Error(`Faixa de vouchers esgotada (${range.from}-${range.to}).`);
  }
  return next;
}

export async function ensureReservationVouchersTx(tx: TxClient, reservationId: string) {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        packageId: true,
        adultsCount: true,
        childrenCount: true,
        adultNames: true,
        adultShirtSizes: true,
        breakfastKitSelections: true,
        childrenNames: true,
        childrenAges: true,
        childrenShirtNumbers: true,
      },
    });
    if (!reservation) return null;

    const expected = reservation.adultsCount + reservation.childrenCount;
    if (expected <= 0) return { reservation, vouchers: [] as const };

    const existing = await tx.reservationVoucher.findMany({
      where: { reservationId },
      orderBy: [{ personType: "asc" }, { personIndex: "asc" }],
    });

    const byKey = new Map<string, (typeof existing)[number]>(
      existing.map((v) => [`${v.personType}:${v.personIndex}`, v])
    );
    const toCreate: Array<{
      personType: "ADULT" | "CHILD";
      personIndex: number;
      name: string;
      age: number | null;
      shirtSize: string;
      hasBreakfastKit: boolean;
    }> = [];

    for (let i = 0; i < reservation.adultsCount; i++) {
      const key = `ADULT:${i}`;
      if (byKey.has(key)) continue;
      toCreate.push({
        personType: "ADULT",
        personIndex: i,
        name: reservation.adultNames[i] ?? "",
        age: null,
        shirtSize: reservation.adultShirtSizes[i] ?? "",
        hasBreakfastKit: Boolean(reservation.breakfastKitSelections[i]),
      });
    }

    for (let i = 0; i < reservation.childrenCount; i++) {
      const key = `CHILD:${i}`;
      if (byKey.has(key)) continue;
      toCreate.push({
        personType: "CHILD",
        personIndex: i,
        name: reservation.childrenNames[i] ?? "",
        age: Number.isInteger(reservation.childrenAges[i]) ? reservation.childrenAges[i]! : null,
        shirtSize: String(reservation.childrenShirtNumbers[i] ?? ""),
        hasBreakfastKit: false,
      });
    }

    for (const row of toCreate) {
      const range =
        row.personType === "CHILD"
          ? VOUCHER_RANGES.CHILD
          : row.hasBreakfastKit
            ? VOUCHER_RANGES.ADULT_WITH_KIT
            : VOUCHER_RANGES.ADULT_NO_KIT;

      const codeNumber = await allocateNextVoucherNumber(tx, reservation.packageId, range);
      const code = formatVoucherCode(codeNumber);

      await tx.reservationVoucher.create({
        data: {
          reservationId,
          packageId: reservation.packageId,
          personType: row.personType,
          personIndex: row.personIndex,
          codeNumber,
          code,
          name: row.name,
          age: row.age ?? undefined,
          shirtSize: row.shirtSize,
          hasBreakfastKit: row.hasBreakfastKit,
        },
      });
    }

    const vouchers = await tx.reservationVoucher.findMany({
      where: { reservationId },
      orderBy: [{ personType: "asc" }, { personIndex: "asc" }],
    });
    return { reservation, vouchers };
}

export async function ensureReservationVouchers(reservationId: string) {
  return prisma.$transaction(async (tx) => ensureReservationVouchersTx(tx, reservationId));
}

export async function sendReservationVouchersIfPaid(reservationId: string, performedByUserId?: string | null) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      paymentStatus: true,
      customerEmailSnapshot: true,
      customerNameSnapshot: true,
      package: { select: { name: true, departureDate: true, departureTime: true, boardingLocation: true, slug: true } },
    },
  });
  if (!reservation) return { ok: false as const, reason: "NOT_FOUND" as const };
  if (reservation.paymentStatus !== "PAID") return { ok: false as const, reason: "NOT_PAID" as const };

  const customerEmail = reservation.customerEmailSnapshot?.trim() ?? "";
  if (!customerEmail || isCustomerPlaceholderEmail(customerEmail)) {
    return { ok: false as const, reason: "NO_CUSTOMER_EMAIL" as const };
  }

  const [alreadyCustomer, alreadyAdmin] = await Promise.all([
    prisma.sentEmail.findFirst({
      where: { emailType: "RESERVATION_VOUCHERS_CUSTOMER", entityType: "Reservation", entityId: reservationId },
      select: { id: true },
    }),
    prisma.sentEmail.findFirst({
      where: { emailType: "RESERVATION_VOUCHERS_ADMIN", entityType: "Reservation", entityId: reservationId },
      select: { id: true },
    }),
  ]);

  const ensured = await ensureReservationVouchers(reservationId);
  if (!ensured) return { ok: false as const, reason: "NOT_FOUND" as const };

  const adminUsers = await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: { in: ["MASTER", "ADMIN"] } }, { isAdmin: true }] },
    select: { email: true },
  });
  const adminTo = adminUsers.map((u) => u.email).filter(Boolean);

  const publicUrl = await resolvePublicAppUrl();
  const when = `${reservation.package.name} (${reservation.package.departureDate.toISOString().slice(0, 10)} às ${reservation.package.departureTime})`;

  const vouchersWithQr = await Promise.all(
    ensured.vouchers.map(async (v) => {
      const checkinUrl = `${publicUrl}/admin/vouchers/${encodeURIComponent(v.code)}/checkin`;
      const viewUrl = `${publicUrl}/voucher/${encodeURIComponent(v.code)}`;
      const qrDataUrl = await QRCode.toDataURL(checkinUrl, { margin: 1, scale: 6 });
      return { v, checkinUrl, viewUrl, qrDataUrl };
    })
  );

  const subject = `Ingressos (QR Code) — ${reservation.package.name}`;
  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111">
    <h2 style="margin:0 0 8px 0">Seus vouchers (ingressos) — ${reservation.package.name}</h2>
    <div style="margin:0 0 14px 0; font-size:14px; color:#444">
      <div><strong>Cliente:</strong> ${escapeHtml(reservation.customerNameSnapshot)}</div>
      <div><strong>Passeio:</strong> ${escapeHtml(when)}</div>
      <div><strong>Embarque:</strong> ${escapeHtml(reservation.package.boardingLocation)}</div>
      <div style="margin-top:8px">Apresente o QR Code abaixo na entrada.</div>
    </div>
    ${vouchersWithQr
      .map(({ v, viewUrl, qrDataUrl }) => {
        const title =
          v.personType === "ADULT"
            ? `Adulto #${v.personIndex + 1}`
            : `Criança #${v.personIndex + 1}`;
        const age = v.personType === "CHILD" && v.age ? ` · Idade: ${v.age}` : "";
        const kit = v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—";
        return `
          <div style="border:1px solid #e5e7eb; border-radius:12px; padding:12px; margin:12px 0">
            <div style="display:flex; gap:14px; align-items:flex-start">
              <div>
                <div style="font-size:12px; color:#666">${escapeHtml(title)}</div>
                <div style="font-size:16px; font-weight:700; margin-top:2px">${escapeHtml(v.name)}</div>
                <div style="margin-top:6px; font-size:13px; color:#333">
                  <div><strong>Camisa:</strong> ${escapeHtml(v.shirtSize)}${age}</div>
                  <div><strong>Kit café:</strong> ${escapeHtml(kit)}</div>
                  <div><strong>Número:</strong> ${escapeHtml(v.code)}</div>
                </div>
                <div style="margin-top:8px; font-size:12px; color:#2563eb">
                  Link do voucher: <a href="${viewUrl}">${viewUrl}</a>
                </div>
              </div>
              <div style="margin-left:auto; text-align:center">
                <img src="${qrDataUrl}" alt="QR Code" style="width:160px; height:160px; background:#fff; border:1px solid #e5e7eb; border-radius:12px" />
              </div>
            </div>
          </div>
        `;
      })
      .join("")}
  </div>
  `;

  await Promise.allSettled([
    alreadyCustomer
      ? Promise.resolve()
      : sendEmailAndRecord({
          to: customerEmail,
          subject,
          html,
          emailType: "RESERVATION_VOUCHERS_CUSTOMER",
          entityType: "Reservation",
          entityId: reservationId,
          performedByUserId: performedByUserId ?? null,
        }),
    !adminTo.length || alreadyAdmin
      ? Promise.resolve()
      : sendEmailAndRecord({
          to: adminTo,
          subject: `[ADMIN] ${subject}`,
          html,
          emailType: "RESERVATION_VOUCHERS_ADMIN",
          entityType: "Reservation",
          entityId: reservationId,
          performedByUserId: performedByUserId ?? null,
        }),
  ]);

  return { ok: true as const, skipped: Boolean(alreadyCustomer && alreadyAdmin) };
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

