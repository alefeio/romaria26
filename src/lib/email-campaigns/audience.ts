import { prisma } from "@/lib/prisma";
import type { EmailAudienceType } from "@/generated/prisma/client";
import { formatDateOnly } from "@/lib/format";

export interface EmailAudienceRecipient {
  recipientType: "student" | "teacher" | "user" | "customer";
  recipientId: string;
  name: string;
  /** E-mail usado para envio: Student.email ?? User.email, Teacher.email ?? User.email, User.email */
  email: string | null;
  /** Matrículas ativas do aluno (quando aplicável). */
  enrollments?: Array<{
    courseName: string | null;
    turmaLine: string | null;
    dataInicio: string | null;
    horario: string | null;
    local: string | null;
  }>;
  /** @deprecated use turmaLine — mantido para compat. */
  classGroupName?: string | null;
  courseName?: string | null;
  /** Dias · horário · local (para placeholder {turma}) */
  turmaLine?: string | null;
  dataInicio?: string | null;
  horario?: string | null;
  local?: string | null;
}

export type EmailAudienceFilters = {
  classGroupId?: string;
  courseId?: string;
  /** IDs de alunos (público SPECIFIC_STUDENTS) */
  studentIds?: string[];
  [key: string]: unknown;
};

/**
 * Reconstroi o destinatário como na resolução de audiência, para re-renderizar placeholders no envio
 * (campanhas antigas com HTML congelado sem substituir {cursos_html}, etc.).
 */
export async function loadRecipientForPlaceholderRender(
  recipientType: string,
  recipientId: string,
  name: string,
  audienceType: EmailAudienceType,
  filters: EmailAudienceFilters | null
): Promise<EmailAudienceRecipient> {
  const base: EmailAudienceRecipient = {
    recipientType: recipientType as EmailAudienceRecipient["recipientType"],
    recipientId,
    name,
    email: null,
  };

  if (recipientType === "customer") {
    const user = await prisma.user.findUnique({
      where: { id: recipientId },
      select: {
        id: true,
        name: true,
        email: true,
        reservations: {
          where: { status: { in: ["PENDING", "CONFIRMED"] } },
          orderBy: { reservedAt: "desc" },
          take: 10,
          select: {
            package: {
              select: {
                name: true,
                departureDate: true,
                departureTime: true,
                boardingLocation: true,
              },
            },
          },
        },
      },
    });
    if (!user) {
      return { ...base, recipientType: "customer", email: null };
    }
    const enrollments = user.reservations.map((r) => {
      const p = r.package;
      const dataInicio = formatDateOnly(p.departureDate);
      const horario = p.departureTime ?? "";
      const local = p.boardingLocation?.trim() ?? "";
      const turmaLine = [dataInicio, horario, local || null].filter(Boolean).join(" · ");
      return {
        courseName: p.name,
        turmaLine,
        dataInicio,
        horario: horario || null,
        local: local || null,
      };
    });
    const primary = enrollments[0];
    return {
      recipientType: "customer",
      recipientId: user.id,
      name: user.name,
      email: user.email?.trim() || null,
      enrollments,
      courseName: primary?.courseName ?? null,
      turmaLine: primary?.turmaLine ?? null,
      classGroupName: primary?.turmaLine ?? null,
      dataInicio: primary?.dataInicio ?? null,
      horario: primary?.horario ?? null,
      local: primary?.local ?? null,
    };
  }

  if (recipientType !== "student") {
    return base;
  }
  void audienceType;
  void filters;
  void recipientId;
  return { ...base, email: null };
}

/**
 * Resolve a lista de destinatários por e-mail conforme tipo de público e filtros.
 * E-mail pode ser null (cadastro incompleto ou sem e-mail).
 */
export async function resolveEmailAudience(
  audienceType: EmailAudienceType,
  filters: EmailAudienceFilters | null
): Promise<EmailAudienceRecipient[]> {
  switch (audienceType) {
    case "ALL_STUDENTS":
    case "ENROLLED_STUDENTS":
    case "CLASS_GROUP":
    case "STUDENTS_INCOMPLETE":
    case "STUDENTS_COMPLETE":
    case "STUDENTS_ACTIVE":
    case "STUDENTS_INACTIVE":
    case "BY_COURSE":
    case "SPECIFIC_STUDENTS":
    case "TEACHERS":
      void filters;
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
        email: u.email?.trim() || null,
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
        email: u.email?.trim() || null,
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
        recipientType: "customer" as const,
        recipientId: u.id,
        name: u.name,
        email: u.email?.trim() || null,
      }));
    }

    case "CUSTOMERS_WITH_RESERVATIONS": {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          role: "CUSTOMER",
          reservations: {
            some: { status: { in: ["PENDING", "CONFIRMED"] } },
          },
        },
        select: { id: true, name: true, email: true },
      });
      return users.map((u) => ({
        recipientType: "customer" as const,
        recipientId: u.id,
        name: u.name,
        email: u.email?.trim() || null,
      }));
    }

    default:
      return [];
  }
}
