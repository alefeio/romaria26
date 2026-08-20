import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { adminCreateVoucherSchema } from "@/lib/validators/vouchers";
import { createAuditLog } from "@/lib/audit";
import { createReservationVoucherAdmin, serializeVoucher } from "@/lib/vouchers/admin-voucher-crud";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function serializeTotals(totals: {
  adultsCount: number;
  childrenCount: number;
  quantity: number;
  totalPrice: { toString(): string };
  totalDue: { toString(): string };
  totalPaid: { toString(): string };
  paymentStatus: string;
} | null | undefined) {
  if (!totals) return null;
  return {
    adultsCount: totals.adultsCount,
    childrenCount: totals.childrenCount,
    quantity: totals.quantity,
    totalPrice: totals.totalPrice.toString(),
    totalDue: totals.totalDue.toString(),
    totalPaid: totals.totalPaid.toString(),
    paymentStatus: totals.paymentStatus,
  };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      packageId: true,
      adultsCount: true,
      childrenCount: true,
      quantity: true,
      totalPrice: true,
      totalDue: true,
      totalPaid: true,
      paymentStatus: true,
      vouchers: { orderBy: [{ personType: "asc" }, { personIndex: "asc" }] },
    },
  });
  if (!reservation) return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);

  return jsonOk({
    reservation: {
      id: reservation.id,
      packageId: reservation.packageId,
      adultsCount: reservation.adultsCount,
      childrenCount: reservation.childrenCount,
      quantity: reservation.quantity,
      totalPrice: reservation.totalPrice.toString(),
      totalDue: reservation.totalDue.toString(),
      totalPaid: reservation.totalPaid.toString(),
      paymentStatus: reservation.paymentStatus,
    },
    vouchers: reservation.vouchers.map(serializeVoucher),
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonErr("INVALID_ID", "ID inválido.", 400);

  const body = await request.json().catch(() => null);
  const parsed = adminCreateVoucherSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;
  if (d.personType === "CHILD" && (d.age == null || !Number.isInteger(d.age))) {
    return jsonErr("VALIDATION_ERROR", "Informe a idade da criança (0 a 10 anos).", 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await createReservationVoucherAdmin(tx, id, {
        personType: d.personType,
        personIndex: d.personIndex,
        name: d.name,
        shirtSize: d.shirtSize,
        age: d.personType === "CHILD" ? d.age ?? null : null,
        hasBreakfastKit: d.personType === "ADULT" ? d.hasBreakfastKit : false,
      });
      if ("err" in created) return created;

      return { ok: created.ok, totals: created.totals };
    });

    if ("err" in result) {
      if (result.err === "NOT_FOUND") return jsonErr("NOT_FOUND", "Reserva não encontrada.", 404);
      if (result.err === "INDEX_IN_USE") {
        return jsonErr("INDEX_IN_USE", "Já existe um voucher para este tipo e índice.", 409);
      }
      return jsonErr("UNKNOWN", "Falha ao criar voucher.", 500);
    }

    await createAuditLog({
      entityType: "Reservation",
      entityId: id,
      action: "RESERVATION_VOUCHER_CREATED",
      diff: { voucherId: result.ok.id, code: result.ok.code, personType: d.personType },
      performedByUserId: auth.id,
    }).catch((e) => console.error("[POST voucher] audit log falhou", e));

    return jsonOk(
      { voucher: serializeVoucher(result.ok), reservation: serializeTotals(result.totals) },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar voucher.";
    if (msg.includes("Faixa de vouchers esgotada")) {
      return jsonErr("VOUCHER_RANGE_EXHAUSTED", msg, 409);
    }
    throw e;
  }
}
