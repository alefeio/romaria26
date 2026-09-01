import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { Reservation, ReservationStatus } from "@/generated/prisma/client";
import { ensureReservationVouchersTx } from "@/lib/vouchers/reservation-vouchers";

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
  adultNames: string[];
  adultShirtSizes: string[];
  adultCourtesySelections?: boolean[];
  childrenNames: string[];
  childrenAges: number[];
  childrenShirtNumbers: number[];
  childrenCourtesySelections?: boolean[];
  childrenOptionalShirtIncluded?: boolean[];
  childrenOptionalShirtPrices?: number[];
  breakfastSelections: boolean[];
  breakfastKitSelections: boolean[];
  paymentPreferenceMethod?: string | null;
  paymentPreferenceInstallments?: number | null;
  customerNameSnapshot: string;
  customerEmailSnapshot: string;
  customerPhoneSnapshot: string;
  notes?: string | null;
  /** Ao confirmar de imediato, preenche `confirmedAt`. */
  initialStatus?: Extract<ReservationStatus, "PENDING" | "CONFIRMED">;
  /**
   * Painel admin: permite reservar em pacote inativo, encerrado, draft, etc.
   * Continua validando capacidade e existência do pacote.
   */
  allowUnavailablePackage?: boolean;
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
    adultNames,
    adultShirtSizes,
    adultCourtesySelections,
    childrenNames,
    childrenAges,
    childrenShirtNumbers,
    childrenCourtesySelections,
    childrenOptionalShirtIncluded,
    childrenOptionalShirtPrices,
    breakfastSelections,
    breakfastKitSelections,
    paymentPreferenceMethod,
    paymentPreferenceInstallments,
    customerNameSnapshot,
    customerEmailSnapshot,
    customerPhoneSnapshot,
    notes,
    initialStatus = "PENDING",
    allowUnavailablePackage = false,
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

  if (!Array.isArray(adultNames) || adultNames.length !== adultsCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o nome completo para cada adulto.");
  }
  const adultFullNames = adultNames.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (adultFullNames.length !== adultsCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o nome completo para cada adulto.");
  }

  if (!Array.isArray(adultShirtSizes) || adultShirtSizes.length !== adultsCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o tamanho da camisa para cada adulto.");
  }
  const adultSizes = adultShirtSizes.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (adultSizes.length !== adultsCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o tamanho da camisa para cada adulto.");
  }
  const adultCourtesies =
    Array.isArray(adultCourtesySelections) && adultCourtesySelections.length === adultsCount
      ? adultCourtesySelections.map((v) => Boolean(v))
      : Array.from({ length: adultsCount }, () => false);

  if (!Array.isArray(childrenNames) || childrenNames.length !== childrenCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o nome completo para cada criança.");
  }
  const childFullNames = childrenNames.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (childFullNames.length !== childrenCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o nome completo para cada criança.");
  }

  if (!Array.isArray(childrenAges) || childrenAges.length !== childrenCount) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe a idade (0 a 10) para cada criança.");
  }
  const childAgeNums = childrenAges.map((n) => (typeof n === "number" ? n : Number(n)));
  if (childAgeNums.some((n) => !Number.isInteger(n) || n < 0 || n > 10)) {
    throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "A idade das crianças deve ser entre 0 e 10 anos.");
  }

  if (!Array.isArray(childrenShirtNumbers) || childrenShirtNumbers.length !== childrenCount) {
    throw new ReservationCreateError(
      "INVALID_CUSTOMER_DATA",
      "Informe o número/tamanho da camisa para cada criança."
    );
  }
  const childNums = childrenShirtNumbers.map((n) => (typeof n === "number" ? n : Number(n)));
  const childCourtesies =
    Array.isArray(childrenCourtesySelections) && childrenCourtesySelections.length === childrenCount
      ? childrenCourtesySelections.map((v) => Boolean(v))
      : Array.from({ length: childrenCount }, () => false);
  const childOptionalIncluded =
    Array.isArray(childrenOptionalShirtIncluded) && childrenOptionalShirtIncluded.length === childrenCount
      ? childrenOptionalShirtIncluded.map((v) => Boolean(v))
      : Array.from({ length: childrenCount }, () => false);
  const childOptionalPrices =
    Array.isArray(childrenOptionalShirtPrices) && childrenOptionalShirtPrices.length === childrenCount
      ? childrenOptionalShirtPrices.map((n) => (typeof n === "number" ? n : Number(n)))
      : Array.from({ length: childrenCount }, () => 0);

  for (let i = 0; i < childrenCount; i++) {
    const age = childAgeNums[i] ?? 0;
    const courtesy = childCourtesies[i];
    const optionalIncluded = childOptionalIncluded[i];
    const optionalPrice = childOptionalPrices[i] ?? 0;
    const freeChild = age < 6 && !courtesy;

    if (freeChild) {
      if (optionalIncluded) {
        if (!Number.isInteger(childNums[i]) || childNums[i] <= 0 || childNums[i] > 120) {
          throw new ReservationCreateError(
            "INVALID_CUSTOMER_DATA",
            "Para criança gratuita com camisa opcional, informe o tamanho da camisa (número)."
          );
        }
        if (!Number.isFinite(optionalPrice) || optionalPrice <= 0) {
          throw new ReservationCreateError(
            "INVALID_CUSTOMER_DATA",
            "Informe o valor da camisa opcional para a criança gratuita."
          );
        }
      }
      continue;
    }

    if (!Number.isInteger(childNums[i]) || childNums[i] <= 0 || childNums[i] > 120) {
      throw new ReservationCreateError(
        "INVALID_CUSTOMER_DATA",
        "Número/tamanho da camisa das crianças deve ser um inteiro (ex.: 6, 8, 10, 12)."
      );
    }
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

  const payMethod = String(paymentPreferenceMethod ?? "").trim().toUpperCase();
  const allowed = new Set(["PIX", "DINHEIRO", "CARTAO", "TRANSFERENCIA", "OUTRO"]);
  if (!payMethod || !allowed.has(payMethod)) {
    throw new ReservationCreateError(
      "INVALID_CUSTOMER_DATA",
      "Informe o tipo de pagamento (Pix, Dinheiro, Cartão, Transferência ou Outro)."
    );
  }
  const installmentsRaw =
    paymentPreferenceInstallments === null || paymentPreferenceInstallments === undefined
      ? null
      : typeof paymentPreferenceInstallments === "number"
        ? paymentPreferenceInstallments
        : Number(paymentPreferenceInstallments);
  const installments = installmentsRaw === null ? null : Math.trunc(installmentsRaw);
  if (payMethod === "CARTAO") {
    if (!installments || !Number.isInteger(installments) || installments < 1 || installments > 12) {
      throw new ReservationCreateError("INVALID_CUSTOMER_DATA", "Informe o número de parcelas (1 a 12) para cartão.");
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "Package" WHERE id = ${packageId} FOR UPDATE
    `);

    // Regra: reservas pendentes seguram vaga por 24h; após isso, cancelam automaticamente.
    const expiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await tx.reservation.updateMany({
      where: { packageId, status: "PENDING", reservedAt: { lt: expiry } },
      data: { status: "CANCELLED", confirmedAt: null },
    });

    const pkg = await tx.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg) {
      throw new ReservationCreateError("PACKAGE_UNAVAILABLE", "Pacote não encontrado.");
    }

    if (!allowUnavailablePackage) {
      if (!pkg.isActive) {
        throw new ReservationCreateError(
          "PACKAGE_UNAVAILABLE",
          "Pacote indisponível ou inativo."
        );
      }

      if (pkg.status !== "OPEN" && pkg.status !== "SOLD_OUT") {
        throw new ReservationCreateError(
          "PACKAGE_UNAVAILABLE",
          "Este pacote não está aberto para reservas."
        );
      }
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
    if (!allowUnavailablePackage) {
      if (used < pkg.capacity && pkg.status === "SOLD_OUT") {
        await tx.package.update({ where: { id: pkg.id }, data: { status: "OPEN" } });
        pkg.status = "OPEN";
      }
    }
    if (used + quantity > pkg.capacity && !allowUnavailablePackage) {
      throw new ReservationCreateError(
        "INSUFFICIENT_CAPACITY",
        "Não há vagas suficientes para esta quantidade."
      );
    }

    const adultUnit = new Prisma.Decimal(pkg.price.toString());
    const childUnit = new Prisma.Decimal(pkg.childPrice.toString());
    const breakfastUnit = new Prisma.Decimal(pkg.breakfastKitPrice.toString());
    const kitCount = kits.filter(Boolean).length;
    const paidAdultsCount = adultCourtesies.filter((isCourtesy) => !isCourtesy).length;
    const paidChildrenCount = childAgeNums.filter((age, index) => age >= 6 && !childCourtesies[index]).length;
    let optionalShirtTotal = new Prisma.Decimal(0);
    for (let i = 0; i < childrenCount; i++) {
      const age = childAgeNums[i] ?? 0;
      if (age < 6 && !childCourtesies[i] && childOptionalIncluded[i] && (childOptionalPrices[i] ?? 0) > 0) {
        optionalShirtTotal = optionalShirtTotal.add(childOptionalPrices[i] ?? 0);
      }
    }
    const totalPrice = adultUnit
      .mul(paidAdultsCount)
      .add(childUnit.mul(paidChildrenCount))
      .add(breakfastUnit.mul(kitCount))
      .add(optionalShirtTotal);
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
        adultNames: adultFullNames,
        adultShirtSizes: adultSizes,
        adultCourtesySelections: adultCourtesies,
        childrenNames: childFullNames,
        childrenAges: childAgeNums,
        childrenShirtNumbers: childNums,
        childrenCourtesySelections: childCourtesies,
        childrenOptionalShirtIncluded: childOptionalIncluded,
        childrenOptionalShirtPrices: childOptionalPrices,
        breakfastSelections: breakfasts,
        breakfastKitSelections: kits,
        includesBreakfastKit: kits.some(Boolean),
        paymentPreferenceMethod: payMethod,
        paymentPreferenceInstallments: payMethod === "CARTAO" ? installments : null,
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

    // Regra: vouchers e numeração sequencial são definidos no ato da reserva.
    await ensureReservationVouchersTx(tx, created.id);

    if (!allowUnavailablePackage && used + quantity >= pkg.capacity && pkg.status === "OPEN") {
      await tx.package.update({ where: { id: pkg.id }, data: { status: "SOLD_OUT" } });

      // Regra: ao esgotar um lote, abrir automaticamente o próximo lote.
      const m = pkg.slug.match(/^lote-(\d+)-(.*)$/i);
      if (m) {
        const curr = Number(m[1]);
        const rest = m[2];
        const nextSlug = `lote-${curr + 1}-${rest}`.toLowerCase();
        const next = await tx.package.findUnique({ where: { slug: nextSlug } });
        if (next && next.isActive && (next.status === "SOON" || next.status === "DRAFT")) {
          await tx.package.update({ where: { id: next.id }, data: { status: "OPEN" } });
        }
      }
    }

    return created;
  });
}

/**
 * Vagas restantes do pacote (somente leitura; não persiste contador).
 * Com `forAdmin: true`, calcula mesmo para pacotes inativos/encerrados (uso no painel).
 */
export async function getPackageRemainingCapacity(
  packageId: string,
  opts?: { forAdmin?: boolean }
): Promise<number | null> {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: { capacity: true, isActive: true, status: true },
  });
  if (!pkg) return null;
  if (!opts?.forAdmin) {
    if (!pkg.isActive) return null;
    if (pkg.status !== "OPEN" && pkg.status !== "SOLD_OUT") return null;
  }

  // Expirar pendentes antigos (24h) para devolver vaga automaticamente.
  const expiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.reservation.updateMany({
    where: { packageId, status: "PENDING", reservedAt: { lt: expiry } },
    data: { status: "CANCELLED", confirmedAt: null },
  });

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
