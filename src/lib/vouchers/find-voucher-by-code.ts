import "server-only";

import { prisma } from "@/lib/prisma";

export type ResolvedVoucherByCode =
  | {
      kind: "reservation";
      voucher: {
        id: string;
        code: string;
        codeNumber: number | null;
        name: string;
        personType: string;
        personIndex: number;
        shirtSize: string;
        age: number | null;
        hasBreakfastKit: boolean;
        usedAt: Date | null;
        releasedAt: Date | null;
        voidedAt: Date | null;
        reservationId: string;
        reservation: {
          id: string;
          customerNameSnapshot: string;
          customerEmailSnapshot: string;
          paymentStatus: string;
          userId: string;
          package: {
            name: string;
            slug: string;
            departureDate: Date;
            departureTime: string;
            boardingLocation: string;
          };
        };
      };
    }
  | {
      kind: "collaborator";
      collaborator: {
        id: string;
        code: string;
        codeNumber: number;
        name: string;
        email: string;
        phone: string | null;
        roleLabel: string | null;
        shirtSize: string | null;
        usedAt: Date | null;
        voidedAt: Date | null;
        packageId: string;
        package: {
          id: string;
          name: string;
          slug: string;
          departureDate: Date;
          departureTime: string;
          boardingLocation: string;
        };
      };
    };

const reservationInclude = {
  reservation: {
    select: {
      id: true,
      customerNameSnapshot: true,
      customerEmailSnapshot: true,
      paymentStatus: true,
      userId: true,
      package: {
        select: {
          name: true,
          slug: true,
          departureDate: true,
          departureTime: true,
          boardingLocation: true,
        },
      },
    },
  },
} as const;

const collaboratorInclude = {
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
} as const;

/** Busca voucher de cliente ou colaborador pelo código exibido (ex.: 3001). */
export async function findVoucherByCode(code: string): Promise<ResolvedVoucherByCode | null> {
  const c = code.trim();
  if (!c) return null;

  const reservationVoucher = await prisma.reservationVoucher.findFirst({
    where: { code: c, voidedAt: null },
    include: reservationInclude,
  });
  if (reservationVoucher) {
    return { kind: "reservation", voucher: reservationVoucher };
  }

  const collaborator = await prisma.eventCollaborator.findFirst({
    where: { code: c, voidedAt: null },
    include: collaboratorInclude,
  });
  if (collaborator) {
    return { kind: "collaborator", collaborator };
  }

  return null;
}

export function isCollaboratorCodeNumber(codeNumber: number): boolean {
  return codeNumber >= 3001 && codeNumber <= 4000;
}
