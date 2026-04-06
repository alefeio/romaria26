import "server-only";

import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  createReservationInTransaction,
  ReservationCreateError,
} from "@/lib/reservations/create-reservation";

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
      includesBreakfastKit: r.includesBreakfastKit,
      totalPrice: r.totalPrice.toString(),
      status: r.status,
      notes: r.notes,
      reservedAt: r.reservedAt.toISOString(),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      package: {
        ...r.package,
        departureDate: r.package.departureDate.toISOString().slice(0, 10),
      },
    })),
  });
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
  const includesBreakfastKit = Boolean(o.includesBreakfastKit);
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
      includesBreakfastKit,
      customerNameSnapshot,
      customerEmailSnapshot,
      customerPhoneSnapshot,
      notes,
      initialStatus,
    });

    return jsonOk({ reservation }, { status: 201 });
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
