import "server-only";

import { jsonErr } from "@/lib/http";
import { ReservationCreateError } from "@/lib/reservations/create-reservation";

/** Resposta JSON para erros comuns ao criar reserva (evita 500 sem corpo). */
export function reservationRouteErrorResponse(e: unknown, logLabel = "reservation create"): Response {
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

  if (e instanceof Error && e.message.includes("Faixa de vouchers esgotada")) {
    return jsonErr("VOUCHER_RANGE_EXHAUSTED", e.message, 409);
  }

  const prismaCode =
    typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  if (prismaCode === "P2002") {
    return jsonErr(
      "VOUCHER_CODE_CONFLICT",
      "Conflito ao gerar número do ingresso. Tente novamente ou contate o suporte.",
      409
    );
  }
  if (prismaCode === "P2022") {
    return jsonErr(
      "SCHEMA_OUT_OF_DATE",
      "Banco de dados desatualizado. Execute as migrations pendentes no servidor.",
      500
    );
  }

  console.error(`[${logLabel}]`, e);
  return jsonErr("INTERNAL_ERROR", "Erro interno ao criar a reserva. Tente novamente.", 500);
}
