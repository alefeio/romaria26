import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSellerApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";
import { formatDateOnly, formatDateOnlyWithTime } from "@/lib/format";
import { recalcReservationPaymentStatus } from "@/lib/payments/reservation-payments";
import { preferenceToPaymentMethod, paymentMethodLabel } from "@/lib/sellers/payment-method";
import {
  createReservationInTransaction,
} from "@/lib/reservations/create-reservation";
import { reservationRouteErrorResponse } from "@/lib/reservations/route-errors";
import { sendReservationVouchersIfPaid } from "@/lib/vouchers/reservation-vouchers";
import { isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";
import { sellerSaleCreateSchema } from "@/lib/validators/seller";
import { isFreeChildAge } from "@/lib/vouchers/shirt";

function serializeSale(r: {
  id: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  customerEmailSnapshot: string;
  quantity: number;
  adultsCount: number;
  childrenCount: number;
  breakfastKitSelections: boolean[];
  totalDue: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  paymentStatus: string;
  status: string;
  paymentPreferenceMethod: string | null;
  reservedAt: Date;
  soldAt: Date | null;
  package: { name: string; departureDate: Date; departureTime: string; boardingLocation: string };
}) {
  return {
    id: r.id,
    customerName: r.customerNameSnapshot,
    customerPhone: r.customerPhoneSnapshot,
    customerEmail: isCustomerPlaceholderEmail(r.customerEmailSnapshot) ? null : r.customerEmailSnapshot,
    quantity: r.quantity,
    adultsCount: r.adultsCount,
    childrenCount: r.childrenCount,
    kitCount: r.breakfastKitSelections.filter(Boolean).length,
    totalDue: r.totalDue.toString(),
    totalPaid: r.totalPaid.toString(),
    paymentStatus: r.paymentStatus,
    status: r.status,
    paymentMethod: r.paymentPreferenceMethod,
    paymentMethodLabel: paymentMethodLabel(r.paymentPreferenceMethod ?? ""),
    reservedAt: r.reservedAt.toISOString(),
    soldAt: (r.soldAt ?? r.reservedAt).toISOString(),
    packageName: r.package.name,
    departureLabel: formatDateOnlyWithTime(r.package.departureDate, r.package.departureTime),
    departureDateLabel: formatDateOnly(r.package.departureDate),
    boardingLocation: r.package.boardingLocation,
  };
}

export async function GET() {
  const auth = await requireSellerApi();
  if (auth instanceof Response) return auth;

  const rows = await prisma.reservation.findMany({
    where: { soldByUserId: auth.id },
    orderBy: [{ soldAt: "desc" }, { reservedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      customerNameSnapshot: true,
      customerPhoneSnapshot: true,
      customerEmailSnapshot: true,
      quantity: true,
      adultsCount: true,
      childrenCount: true,
      breakfastKitSelections: true,
      totalDue: true,
      totalPaid: true,
      paymentStatus: true,
      status: true,
      paymentPreferenceMethod: true,
      reservedAt: true,
      soldAt: true,
      package: { select: { name: true, departureDate: true, departureTime: true, boardingLocation: true } },
    },
  });

  const paid = rows.filter((r) => r.paymentStatus === "PAID" && r.status !== "CANCELLED");
  const totalCharged = paid.reduce((sum, r) => sum.add(r.totalDue), new Prisma.Decimal(0));

  return jsonOk({
    items: rows.map(serializeSale),
    summary: {
      salesCount: paid.length,
      tickets: paid.reduce((n, r) => n + r.quantity, 0),
      totalCharged: totalCharged.toString(),
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireSellerApi();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = sellerSaleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const d = parsed.data;

  const customer = await prisma.user.findUnique({
    where: { id: d.userId },
    select: { id: true, role: true, isActive: true, name: true, email: true, phone: true },
  });
  if (!customer || customer.role !== "CUSTOMER") {
    return jsonErr("INVALID_CUSTOMER", "Cliente não encontrado.", 404);
  }
  if (!customer.isActive) {
    return jsonErr("INACTIVE_CUSTOMER", "O cliente está inativo.", 400);
  }

  const method = preferenceToPaymentMethod(d.paymentPreferenceMethod);
  if (!method) {
    return jsonErr("VALIDATION_ERROR", "Forma de pagamento inválida.", 400);
  }

  const childrenShirtNumbers = d.childrenAges.map((age, i) =>
    isFreeChildAge(age) ? 0 : Number(d.childrenShirtNumbers[i] ?? 0)
  );

  try {
    const reservation = await createReservationInTransaction({
      packageId: d.packageId,
      userId: d.userId,
      quantity: d.quantity,
      adultsCount: d.adultsCount,
      childrenCount: d.childrenCount,
      adultNames: d.adultNames.map((s) => String(s ?? "")),
      adultShirtSizes: d.adultShirtSizes.map((s) => String(s ?? "")),
      adultCourtesySelections: Array.from({ length: d.adultsCount }, () => false),
      childrenNames: d.childrenNames.map((s) => String(s ?? "")),
      childrenAges: d.childrenAges.map((n) => Number(n)),
      childrenShirtNumbers,
      childrenCourtesySelections: Array.from({ length: d.childrenCount }, () => false),
      childrenOptionalShirtIncluded: Array.from({ length: d.childrenCount }, () => false),
      childrenOptionalShirtPrices: Array.from({ length: d.childrenCount }, () => 0),
      breakfastSelections: Array.from({ length: d.quantity }, () => false),
      breakfastKitSelections: d.breakfastKitSelections.map((v) => Boolean(v)),
      paymentPreferenceMethod: d.paymentPreferenceMethod,
      paymentPreferenceInstallments: d.paymentPreferenceInstallments ?? null,
      customerNameSnapshot: d.customerNameSnapshot,
      customerEmailSnapshot: d.customerEmailSnapshot,
      customerPhoneSnapshot: d.customerPhoneSnapshot,
      notes: d.notes ?? null,
      initialStatus: "CONFIRMED",
      allowUnavailablePackage: false,
      allowCourtesy: false,
      soldByUserId: auth.id,
    });

    const payResult = await prisma.$transaction(async (tx) => {
      const fresh = await tx.reservation.findUnique({
        where: { id: reservation.id },
        select: { id: true, totalDue: true, paymentStatus: true },
      });
      if (!fresh) return null;
      if (fresh.paymentStatus === "PAID") {
        return { alreadyPaid: true as const, totalDue: fresh.totalDue };
      }
      await tx.reservationPayment.create({
        data: {
          reservationId: reservation.id,
          amount: fresh.totalDue,
          paidAt: new Date(),
          method,
          note: `Recebido no stand pela vendedora ${auth.name}.`,
        },
      });
      const updated = await recalcReservationPaymentStatus(tx, reservation.id);
      return { alreadyPaid: false as const, totalDue: fresh.totalDue, updated };
    });

    if (!payResult) {
      return jsonErr("NOT_FOUND", "Reserva não encontrada após o lançamento.", 500);
    }

    await createAuditLog({
      entityType: "Reservation",
      entityId: reservation.id,
      action: "RESERVATION_CREATED",
      diff: { via: "SELLER_STAND", totalDue: reservation.totalDue.toString() },
      performedByUserId: auth.id,
    });
    await createAuditLog({
      entityType: "Reservation",
      entityId: reservation.id,
      action: "STAND_PAYMENT_RECORDED",
      diff: {
        amount: payResult.totalDue.toString(),
        method,
        paymentStatus: payResult.updated?.paymentStatus ?? "PAID",
      },
      performedByUserId: auth.id,
    });

    if (payResult.updated?.paymentStatus === "PAID" || payResult.alreadyPaid) {
      await sendReservationVouchersIfPaid(reservation.id, auth.id).catch(() => null);
    }

    const full = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      select: {
        id: true,
        customerNameSnapshot: true,
        customerPhoneSnapshot: true,
        customerEmailSnapshot: true,
        quantity: true,
        adultsCount: true,
        childrenCount: true,
        adultNames: true,
        childrenNames: true,
        childrenAges: true,
        breakfastKitSelections: true,
        totalDue: true,
        totalPaid: true,
        paymentStatus: true,
        status: true,
        paymentPreferenceMethod: true,
        reservedAt: true,
        soldAt: true,
        package: { select: { name: true, departureDate: true, departureTime: true, boardingLocation: true } },
        vouchers: {
          where: { voidedAt: null },
          orderBy: [{ personType: "asc" }, { personIndex: "asc" }],
          select: { code: true, name: true, personType: true, releasedAt: true },
        },
      },
    });
    if (!full) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

    return jsonOk(
      {
        sale: {
          ...serializeSale(full),
          adultNames: full.adultNames,
          childrenNames: full.childrenNames,
          childrenAges: full.childrenAges,
          vouchers: full.vouchers.map((v) => ({
            code: v.code,
            name: v.name,
            personType: v.personType,
            released: Boolean(v.releasedAt),
          })),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return reservationRouteErrorResponse(e, "seller sale create");
  }
}
