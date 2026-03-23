import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { Reservation, ReservationStatus } from "@/generated/prisma/client";

/**
 * Reservas que ocupam vagas: derivado das linhas em `Reservation`, sem campo
 * `remainingSlots` persistido no pacote. Inclui PENDING para evitar overbooking
 * com requisições simultâneas até confirmação/cancelamento.
 */
export const RESERVATION_STATUSES_THAT_OCCUPY_CAPACITY: ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
];

export type CreateReservationInput = {
  packageId: string;
  userId: string;
  quantity: number;
  includesBreakfastKit: boolean;
  customerNameSnapshot: string;
  customerEmailSnapshot: string;
  customerPhoneSnapshot: string;
  notes?: string | null;
  /** Ao confirmar de imediato, preenche `confirmedAt`. */
  initialStatus?: Extract<ReservationStatus, "PENDING" | "CONFIRMED">;
};

export class ReservationCreateError extends Error {
  constructor(
    public readonly code:
      | "BREAKFAST_NOT_ALLOWED"
      | "PACKAGE_UNAVAILABLE"
      | "INSUFFICIENT_CAPACITY"
      | "INVALID_QUANTITY"
      | "INVALID_CUSTOMER_DATA",
    message: string
  ) {
    super(message);
    this.name = "ReservationCreateError";
  }
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

/**
 * Cria reserva com validação do kit café, bloqueio de linha do pacote (`FOR UPDATE`)
 * e checagem de capacidade por agregação das reservas ativas (transação única).
 */
export async function createReservationInTransaction(
  input: CreateReservationInput
): Promise<Reservation> {
  const {
    packageId,
    userId,
    quantity,
    includesBreakfastKit,
    customerNameSnapshot,
    customerEmailSnapshot,
    customerPhoneSnapshot,
    notes,
    initialStatus = "CONFIRMED",
  } = input;

  if (!isUuid(packageId) || !isUuid(userId)) {
    throw new ReservationCreateError("PACKAGE_UNAVAILABLE", "Identificador inválido.");
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ReservationCreateError(
      "INVALID_QUANTITY",
      "Quantidade deve ser um inteiro maior ou igual a 1."
    );
  }

  const name = customerNameSnapshot?.trim() ?? "";
  const email = customerEmailSnapshot?.trim() ?? "";
  const phone = customerPhoneSnapshot?.trim() ?? "";
  if (!name || !email || !phone) {
    throw new ReservationCreateError(
      "INVALID_CUSTOMER_DATA",
      "Nome, e-mail e telefone do cliente são obrigatórios."
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "Package" WHERE id = ${packageId}::uuid FOR UPDATE
    `);

    const pkg = await tx.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg || !pkg.isActive) {
      throw new ReservationCreateError(
        "PACKAGE_UNAVAILABLE",
        "Pacote indisponível ou inativo."
      );
    }

    if (pkg.status !== "OPEN") {
      throw new ReservationCreateError(
        "PACKAGE_UNAVAILABLE",
        "Este pacote não está aberto para reservas."
      );
    }

    if (!pkg.breakfastKitAvailable && includesBreakfastKit) {
      throw new ReservationCreateError(
        "BREAKFAST_NOT_ALLOWED",
        "Este pacote não oferece opção de kit café da manhã."
      );
    }

    const agg = await tx.reservation.aggregate({
      where: {
        packageId,
        status: { in: [...RESERVATION_STATUSES_THAT_OCCUPY_CAPACITY] },
      },
      _sum: { quantity: true },
    });

    const used = agg._sum.quantity ?? 0;
    if (used + quantity > pkg.capacity) {
      throw new ReservationCreateError(
        "INSUFFICIENT_CAPACITY",
        "Não há vagas suficientes para esta quantidade."
      );
    }

    const unitBase = new Prisma.Decimal(pkg.price.toString());
    const breakfastUnit = includesBreakfastKit
      ? new Prisma.Decimal(pkg.breakfastKitPrice.toString())
      : new Prisma.Decimal(0);
    const unitTotal = unitBase.add(breakfastUnit);
    const totalPrice = unitTotal.mul(quantity);

    const now = new Date();
    const confirmedAt = initialStatus === "CONFIRMED" ? now : null;

    return tx.reservation.create({
      data: {
        userId,
        packageId,
        customerNameSnapshot: name,
        customerEmailSnapshot: email,
        customerPhoneSnapshot: phone,
        quantity,
        includesBreakfastKit,
        unitPriceSnapshot: unitBase,
        breakfastKitUnitPriceSnapshot: breakfastUnit,
        totalPrice,
        status: initialStatus,
        notes: notes?.trim() || null,
        reservedAt: now,
        confirmedAt,
      },
    });
  });
}

/**
 * Vagas restantes do pacote (somente leitura; não persiste contador).
 */
export async function getPackageRemainingCapacity(packageId: string): Promise<number | null> {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: { capacity: true, isActive: true, status: true },
  });
  if (!pkg || !pkg.isActive || pkg.status !== "OPEN") return null;

  const agg = await prisma.reservation.aggregate({
    where: {
      packageId,
      status: { in: [...RESERVATION_STATUSES_THAT_OCCUPY_CAPACITY] },
    },
    _sum: { quantity: true },
  });
  const used = agg._sum.quantity ?? 0;
  return Math.max(0, pkg.capacity - used);
}
