import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { VoucherPersonType } from "@/generated/prisma/client";
import type { ReservationDbClient } from "@/lib/payments/reservation-payments";
import {
  ACTIVE_VOUCHER_FILTER,
  allocateNextVoucherCode,
  linkVoucherCodeLedger,
  VOUCHER_RANGES,
} from "@/lib/vouchers/reservation-vouchers";
import { resolveChildVoucherShirtFields } from "@/lib/vouchers/sync-reservation-pricing";
import { syncReservationFromVouchers } from "@/lib/vouchers/sync-reservation-from-vouchers";

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
  hasOptionalPaidShirt: boolean;
  optionalShirtPrice: string | null;
  usedAt: string | null;
  releasedAt: string | null;
  voidedAt: string | null;
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
  hasOptionalPaidShirt: boolean;
  optionalShirtPrice: Prisma.Decimal | null;
  usedAt: Date | null;
  releasedAt: Date | null;
  voidedAt: Date | null;
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
    hasOptionalPaidShirt: v.hasOptionalPaidShirt,
    optionalShirtPrice: v.optionalShirtPrice?.toString() ?? null,
    usedAt: v.usedAt?.toISOString() ?? null,
    releasedAt: v.releasedAt?.toISOString() ?? null,
    voidedAt: v.voidedAt?.toISOString() ?? null,
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
    where: { reservationId, personType, ...ACTIVE_VOUCHER_FILTER },
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
    hasOptionalPaidShirt?: boolean;
    optionalShirtPrice?: number | string | null;
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
    where: { reservationId, personType, personIndex, ...ACTIVE_VOUCHER_FILTER },
    select: { id: true },
  });
  if (clash) return { err: "INDEX_IN_USE" as const };

  const shirtFields =
    personType === "CHILD"
      ? resolveChildVoucherShirtFields({
          age: input.age ?? null,
          shirtSize: input.shirtSize,
          hasOptionalPaidShirt: input.hasOptionalPaidShirt,
          optionalShirtPrice: input.optionalShirtPrice,
        })
      : {
          shirtSize: input.shirtSize.trim(),
          hasOptionalPaidShirt: false,
          optionalShirtPrice: null as number | null,
        };

  const range = rangeFor(personType, hasBreakfastKit);
  const { codeNumber, code } = await allocateNextVoucherCode(tx, range);

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
      shirtSize: shirtFields.shirtSize,
      hasBreakfastKit,
      hasOptionalPaidShirt: shirtFields.hasOptionalPaidShirt,
      optionalShirtPrice: shirtFields.optionalShirtPrice ?? undefined,
    },
  });
  await linkVoucherCodeLedger(tx, codeNumber, { voucherId: row.id });

  const totals = await syncReservationFromVouchers(tx, reservationId);

  return { ok: row, totals };
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
    hasOptionalPaidShirt?: boolean;
    optionalShirtPrice?: number | string | null;
    personIndex?: number;
    personType?: VoucherPersonType;
  }
) {
  const existing = await tx.reservationVoucher.findFirst({
    where: { id: voucherId, reservationId, ...ACTIVE_VOUCHER_FILTER },
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
  const age = input.age !== undefined ? input.age : existing.age;

  if (personIndex !== existing.personIndex || personType !== existing.personType) {
    const clash = await tx.reservationVoucher.findFirst({
      where: {
        reservationId,
        personType,
        personIndex,
        ...ACTIVE_VOUCHER_FILTER,
        NOT: { id: voucherId },
      },
      select: { id: true },
    });
    if (clash) return { err: "INDEX_IN_USE" as const };
  }

  const shirtFields =
    personType === "CHILD"
      ? resolveChildVoucherShirtFields({
          age,
          shirtSize: input.shirtSize ?? existing.shirtSize,
          hasOptionalPaidShirt:
            input.hasOptionalPaidShirt !== undefined
              ? input.hasOptionalPaidShirt
              : existing.hasOptionalPaidShirt,
          optionalShirtPrice:
            input.optionalShirtPrice !== undefined
              ? input.optionalShirtPrice
              : existing.optionalShirtPrice?.toString() ?? null,
        })
      : {
          shirtSize: (input.shirtSize ?? existing.shirtSize).trim(),
          hasOptionalPaidShirt: false,
          optionalShirtPrice: null as number | null,
        };

  let codeNumber = existing.codeNumber;
  let code = existing.code;
  const rangeChanged =
    personType !== existing.personType || hasBreakfastKit !== existing.hasBreakfastKit;

  if (rangeChanged) {
    await tx.voucherCodeLedger.updateMany({
      where: { voucherId: existing.id },
      data: { voucherId: null },
    });
    const range = rangeFor(personType, hasBreakfastKit);
    const allocated = await allocateNextVoucherCode(tx, range);
    codeNumber = allocated.codeNumber;
    code = allocated.code;
  }

  const row = await tx.reservationVoucher.update({
    where: { id: voucherId },
    data: {
      personType,
      personIndex,
      codeNumber,
      code,
      name: input.name !== undefined ? input.name.trim() : undefined,
      shirtSize: shirtFields.shirtSize,
      age:
        input.age !== undefined
          ? personType === "CHILD" && input.age != null
            ? input.age
            : null
          : undefined,
      hasBreakfastKit,
      hasOptionalPaidShirt: shirtFields.hasOptionalPaidShirt,
      optionalShirtPrice: shirtFields.optionalShirtPrice ?? null,
    },
  });

  if (rangeChanged && codeNumber != null) {
    await linkVoucherCodeLedger(tx, codeNumber, { voucherId: row.id });
  }

  const totals = await syncReservationFromVouchers(tx, reservationId);

  return { ok: row, totals };
}

export async function deleteReservationVoucherAdmin(
  tx: ReservationDbClient,
  reservationId: string,
  voucherId: string
) {
  const existing = await tx.reservationVoucher.findFirst({
    where: { id: voucherId, reservationId, ...ACTIVE_VOUCHER_FILTER },
    select: { id: true, code: true, name: true, usedAt: true },
  });
  if (!existing) return { err: "NOT_FOUND" as const };

  const now = new Date();
  await tx.reservationVoucher.update({
    where: { id: voucherId },
    data: { voidedAt: now },
  });
  const totals = await syncReservationFromVouchers(tx, reservationId);

  return { ok: { ...existing, voidedAt: now }, totals };
}
