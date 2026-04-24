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
  adultsCount: number;
  childrenCount: number;
  adultShirtSizes: string[];
  childrenShirtNumbers: number[];
  breakfastSelections: boolean[];
  breakfastKitSelections: boolean[];
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
    adultsCount,
    childrenCount,
    adultShirtSizes,
    childrenShirtNumbers,
    breakfastSelections,
    breakfastKitSelections,
    customerNameSnapshot,
    customerEmailSnapshot,
    customerPhoneSnapshot,
    notes,
    initialStatus = "PENDING",
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

  if (!Number.isInteger(adultsCount) || adultsCount < 0) {
    throw new ReservationCreateError("INVALID_QUANTITY", "Quantidade de adultos inválida.");
  }
  if (!Number.isInteger(childrenCount) || childrenCount < 0) {
    throw new ReservationCreateError("INVALID_QUANTITY", "Quantidade de crianças inválida.");
  }
  if (adultsCount + childrenCount !== quantity) {
    throw new ReservationCreateError("INVALID_QUANTITY", "A soma de adultos e crianças deve ser igual ao total.");
  }

  if (!Array.isArray(adultShirtSizes) || adultShirtSizes.length !== adultsCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o tamanho da camisa para cada adulto.");
  }
  const adultSizes = adultShirtSizes.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (adultSizes.length !== adultsCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o tamanho da camisa para cada adulto.");
  }

  if (!Array.isArray(childrenShirtNumbers) || childrenShirtNumbers.length !== childrenCount) {
    throw new ReservationCreateError(
      "INVALID_CUSTOMER_DATA",
      "Informe a idade/número da camisa para cada criança."
    );
  }
  const childNums = childrenShirtNumbers.map((n) => (typeof n === "number" ? n : Number(n)));
  if (childNums.some((n) => !Number.isInteger(n) || n <= 0 || n > 120)) {
    throw new ReservationCreateError(
      "INVALID_CUSTOMER_DATA",
      "Idade/número da camisa das crianças deve ser um inteiro (ex.: 6, 8, 10, 12)."
    );
  }

  if (!Array.isArray(breakfastSelections) || breakfastSelections.length !== quantity) {
    throw new ReservationCreateError(
      "INVALID_CUSTOMER_DATA",
      "Marque o café da manhã individualmente em cada ingresso."
    );
  }
  const breakfasts = breakfastSelections.map((v) => Boolean(v));

  if (!Array.isArray(breakfastKitSelections) || breakfastKitSelections.length !== adultsCount) {
    throw new ReservationCreateError(
      "INVALID_CUSTOMER_DATA",
      "Marque o kit café individualmente para cada adulto (quando aplicável)."
    );
  }
  const kits = breakfastKitSelections.map((v) => Boolean(v));

  const name = customerNameSnapshot?.trim() ?? "";
  const email = customerEmailSnapshot?.trim().toLowerCase() ?? "";
  const phone = customerPhoneSnapshot?.trim() ?? "";
  if (!name || !email || !phone) {
    throw new ReservationCreateError(
      "INVALID_CUSTOMER_DATA",
      "Nome, e-mail e telefone do cliente são obrigatórios."
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "Package" WHERE id = ${packageId} FOR UPDATE
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

    if (!pkg.breakfastKitAvailable && kits.some(Boolean)) {
      throw new ReservationCreateError("BREAKFAST_NOT_ALLOWED", "Este pacote não oferece opção de kit café da manhã.");
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

    const adultUnit = new Prisma.Decimal(pkg.price.toString());
    const childUnit = new Prisma.Decimal(pkg.childPrice.toString());
    const breakfastUnit = new Prisma.Decimal(pkg.breakfastKitPrice.toString());
    const kitCount = kits.filter(Boolean).length;
    const totalPrice = adultUnit.mul(adultsCount).add(childUnit.mul(childrenCount)).add(breakfastUnit.mul(kitCount));
    const totalDue = totalPrice;

    const now = new Date();
    const confirmedAt = initialStatus === "CONFIRMED" ? now : null;

    const created = await tx.reservation.create({
      data: {
        userId,
        packageId,
        customerNameSnapshot: name,
        customerEmailSnapshot: email,
        customerPhoneSnapshot: phone,
        quantity,
        adultsCount,
        childrenCount,
        adultShirtSizes: adultSizes,
        childrenShirtNumbers: childNums,
        breakfastSelections: breakfasts,
        breakfastKitSelections: kits,
        includesBreakfastKit: kits.some(Boolean),
        unitPriceSnapshot: adultUnit,
        breakfastKitUnitPriceSnapshot: breakfastUnit,
        totalPrice,
        amountAdultSnapshot: adultUnit,
        amountChildSnapshot: childUnit,
        totalDue,
        totalPaid: new Prisma.Decimal(0),
        paymentStatus: "UNPAID",
        status: initialStatus,
        notes: notes?.trim() || null,
        kitsDeliveryInfoSnapshot: pkg.kitsDeliveryInfo?.trim() || null,
        reservedAt: now,
        confirmedAt,
      },
    });

    if (used + quantity >= pkg.capacity && pkg.status === "OPEN") {
      await tx.package.update({ where: { id: pkg.id }, data: { status: "SOLD_OUT" } });
    }

    return created;
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
  if (!pkg || !pkg.isActive) return null;
  if (pkg.status !== "OPEN" && pkg.status !== "SOLD_OUT") return null;

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
