import { prisma } from "@/lib/prisma";
import { requireSellerApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { formatDateOnly, formatDateOnlyWithTime } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/sellers/payment-method";
import { isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSellerApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const r = await prisma.reservation.findFirst({
    where: { id, soldByUserId: auth.id },
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
  if (!r) return jsonErr("NOT_FOUND", "Venda não encontrada.", 404);

  return jsonOk({
    sale: {
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
      adultNames: r.adultNames,
      childrenNames: r.childrenNames,
      childrenAges: r.childrenAges,
      vouchers: r.vouchers.map((v) => ({
        code: v.code,
        name: v.name,
        personType: v.personType,
        released: Boolean(v.releasedAt),
      })),
    },
  });
}
