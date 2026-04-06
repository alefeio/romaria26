import { prisma } from "@/lib/prisma";
import type { SmsAudienceType } from "@/generated/prisma/client";

export interface AudienceRecipient {
  recipientType: "student" | "teacher" | "user";
  recipientId: string;
  name: string;
  phone: string | null;
  classGroupName?: string | null;
  courseName?: string | null;
}

export type AudienceFilters = {
  classGroupId?: string;
  courseId?: string;
  [key: string]: unknown;
};

/**
 * Resolve a lista de destinatários conforme tipo de público e filtros.
 * Telefones de usuários vêm de reservas quando aplicável; caso contrário podem ser null.
 */
export async function resolveSmsAudience(
  audienceType: SmsAudienceType,
  filters: AudienceFilters | null
): Promise<AudienceRecipient[]> {
  void filters;
  switch (audienceType) {
    case "ALL_STUDENTS":
    case "CLASS_GROUP":
    case "STUDENTS_INCOMPLETE":
    case "STUDENTS_COMPLETE":
    case "STUDENTS_ACTIVE":
    case "STUDENTS_INACTIVE":
    case "BY_COURSE":
    case "TEACHERS":
      return [];

    case "ADMINS": {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [{ role: "ADMIN" }, { role: "MASTER" }, { isAdmin: true }],
        },
        select: { id: true, name: true, email: true },
      });
      return users.map((u) => ({
        recipientType: "user" as const,
        recipientId: u.id,
        name: u.name,
        phone: null,
        classGroupName: null,
        courseName: null,
      }));
    }

    case "ALL_ACTIVE_USERS": {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      });
      return users.map((u) => ({
        recipientType: "user" as const,
        recipientId: u.id,
        name: u.name,
        phone: null,
        classGroupName: null,
        courseName: null,
      }));
    }

    case "ALL_CUSTOMERS": {
      const users = await prisma.user.findMany({
        where: { isActive: true, role: "CUSTOMER" },
        select: { id: true, name: true, email: true },
      });
      return users.map((u) => ({
        recipientType: "user" as const,
        recipientId: u.id,
        name: u.name,
        phone: null,
        classGroupName: null,
        courseName: null,
      }));
    }

    case "CUSTOMERS_WITH_RESERVATIONS": {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          role: "CUSTOMER",
          reservations: { some: { status: { in: ["PENDING", "CONFIRMED"] } } },
        },
        select: {
          id: true,
          name: true,
          reservations: {
            where: { status: { in: ["PENDING", "CONFIRMED"] } },
            orderBy: { reservedAt: "desc" },
            take: 1,
            select: { customerPhoneSnapshot: true },
          },
        },
      });
      return users.map((u) => ({
        recipientType: "user" as const,
        recipientId: u.id,
        name: u.name,
        phone: u.reservations[0]?.customerPhoneSnapshot?.trim() || null,
        classGroupName: null,
        courseName: null,
      }));
    }

    default:
      return [];
  }
}
