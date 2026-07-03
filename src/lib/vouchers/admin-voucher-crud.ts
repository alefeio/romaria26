import "server-only";

import type { VoucherPersonType } from "@/generated/prisma/client";
import type { ReservationDbClient } from "@/lib/payments/reservation-payments";
import { VOUCHER_RANGES, allocateNextVoucherNumber, formatVoucherCode } from "@/lib/vouchers/reservation-vouchers";

export type VoucherRow = {
  id: string;
  personType: VoucherPersonType;
  personIndex: number;
  code: string;
  codeNumber: number | null;
  name: string;
  age: number | null;
  shirtSize: string;
  hasBreakfastKit: boolean;
  usedAt: string | null;
  createdAt: string;
};

export function serializeVoucher(v: {
  id: string;
  personType: VoucherPersonType;
  personIndex: number;
  code: string;
  codeNumber: number | null;
  name: string;
  age: number | null;
  shirtSize: string;
  hasBreakfastKit: boolean;
  usedAt: Date | null;
  createdAt: Date;
}): VoucherRow {
  return {
    id: v.id,
    personType: v.personType,
    personIndex: v.personIndex,
    code: v.code,
    codeNumber: v.codeNumber,
    name: v.name,
    age: v.age,
    shirtSize: v.shirtSize,
    hasBreakfastKit: v.hasBreakfastKit,
    usedAt: v.usedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  };
}

function rangeFor(personType: VoucherPersonType, hasBreakfastKit: boolean) {
  if (personType === "CHILD") return VOUCHER_RANGES.CHILD;
  return hasBreakfastKit ? VOUCHER_RANGES.ADULT_WITH_KIT : VOUCHER_RANGES.ADULT_NO_KIT;
}

async function nextPersonIndex(
  tx: ReservationDbClient,
  reservationId: string,
  personType: VoucherPersonType,
  preferred?: number
): Promise<number> {
  const existing = await tx.reservationVoucher.findMany({
    where: { reservationId, personType },
    select: { personIndex: true },
  });
  const used = new Set(existing.map((e) => e.personIndex));
  if (preferred !== undefined && !used.has(preferred)) return preferred;
  let i = 0;
  while (used.has(i)) i++;
  return i;
}

export async function createReservationVoucherAdmin(
  tx: ReservationDbClient,
  reservationId: string,
  input: {
    personType: VoucherPersonType;
    personIndex?: number;
    name: string;
    shirtSize: string;
    age?: number | null;
    hasBreakfastKit?: boolean;
  }
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, packageId: true },
  });
  if (!reservation) return { err: "NOT_FOUND" as const };

  const personType = input.personType;
  const hasBreakfastKit = personType === "ADULT" ? Boolean(input.hasBreakfastKit) : false;
  const personIndex = await nextPersonIndex(tx, reservationId, personType, input.personIndex);

  const clash = await tx.reservationVoucher.findFirst({
    where: { reservationId, personType, personIndex },
    select: { id: true },
  });
  if (clash) return { err: "INDEX_IN_USE" as const };

  const range = rangeFor(personType, hasBreakfastKit);
  const codeNumber = await allocateNextVoucherNumber(tx, range);
  const code = formatVoucherCode(codeNumber);

  const row = await tx.reservationVoucher.create({
    data: {
      reservationId,
      packageId: reservation.packageId,
      personType,
      personIndex,
      codeNumber,
      code,
      name: input.name.trim(),
      age: personType === "CHILD" && input.age != null ? input.age : undefined,
      shirtSize: input.shirtSize.trim(),
      hasBreakfastKit,
    },
  });

  return { ok: row };
}

export async function updateReservationVoucherAdmin(
  tx: ReservationDbClient,
  reservationId: string,
  voucherId: string,
  input: {
    name?: string;
    shirtSize?: string;
    age?: number | null;
    hasBreakfastKit?: boolean;
    personIndex?: number;
    personType?: VoucherPersonType;
  }
) {
  const existing = await tx.reservationVoucher.findFirst({
    where: { id: voucherId, reservationId },
  });
  if (!existing) return { err: "NOT_FOUND" as const };

  const personType = input.personType ?? existing.personType;
  const hasBreakfastKit =
    personType === "ADULT"
      ? input.hasBreakfastKit !== undefined
        ? input.hasBreakfastKit
        : existing.hasBreakfastKit
      : false;
  const personIndex = input.personIndex ?? existing.personIndex;

  if (personIndex !== existing.personIndex || personType !== existing.personType) {
    const clash = await tx.reservationVoucher.findFirst({
      where: {
        reservationId,
        personType,
        personIndex,
        NOT: { id: voucherId },
      },
      select: { id: true },
    });
    if (clash) return { err: "INDEX_IN_USE" as const };
  }

  let codeNumber = existing.codeNumber;
  let code = existing.code;
  const rangeChanged =
    personType !== existing.personType || hasBreakfastKit !== existing.hasBreakfastKit;

  if (rangeChanged) {
    const range = rangeFor(personType, hasBreakfastKit);
    codeNumber = await allocateNextVoucherNumber(tx, range);
    code = formatVoucherCode(codeNumber);
  }

  const row = await tx.reservationVoucher.update({
    where: { id: voucherId },
    data: {
      personType,
      personIndex,
      codeNumber,
      code,
      name: input.name !== undefined ? input.name.trim() : undefined,
      shirtSize: input.shirtSize !== undefined ? input.shirtSize.trim() : undefined,
      age:
        input.age !== undefined
          ? personType === "CHILD" && input.age != null
            ? input.age
            : null
          : undefined,
      hasBreakfastKit,
    },
  });

  return { ok: row };
}
