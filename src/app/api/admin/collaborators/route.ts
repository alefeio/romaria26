import "server-only";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { createAuditLog } from "@/lib/audit";
import { createEventCollaborator } from "@/lib/collaborators/collaborator-vouchers";
import { adminCreateCollaboratorSchema } from "@/lib/validators/collaborators";

function serializeCollaborator(row: {
  id: string;
  packageId: string;
  name: string;
  email: string;
  phone: string | null;
  roleLabel: string | null;
  shirtSize: string | null;
  notes: string | null;
  code: string;
  codeNumber: number;
  usedAt: Date | null;
  voidedAt: Date | null;
  emailedAt: Date | null;
  createdAt: Date;
  package: { id: string; name: string; slug: string; departureDate: Date };
}) {
  return {
    id: row.id,
    packageId: row.packageId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    roleLabel: row.roleLabel,
    shirtSize: row.shirtSize,
    notes: row.notes,
    code: row.code,
    codeNumber: row.codeNumber,
    usedAt: row.usedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    emailedAt: row.emailedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    package: {
      id: row.package.id,
      name: row.package.name,
      slug: row.package.slug,
      departureDate: row.package.departureDate.toISOString().slice(0, 10),
    },
  };
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const packageId = searchParams.get("packageId");
  const q = (searchParams.get("q") ?? "").trim();

  const where: {
    voidedAt: null;
    packageId?: string;
    OR?: Array<Record<string, unknown>>;
  } = { voidedAt: null };

  if (packageId && /^[0-9a-f-]{36}$/i.test(packageId)) {
    where.packageId = packageId;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { roleLabel: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.eventCollaborator.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    include: {
      package: { select: { id: true, name: true, slug: true, departureDate: true } },
    },
  });

  return jsonOk({ items: rows.map(serializeCollaborator) });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = adminCreateCollaboratorSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;

  try {
    const result = await createEventCollaborator(
      {
        packageId: d.packageId,
        name: d.name,
        email: d.email,
        phone: d.phone,
        roleLabel: d.roleLabel,
        shirtSize: d.shirtSize,
        notes: d.notes,
      },
      auth.id
    );

    if ("err" in result) {
      if (result.err === "PACKAGE_NOT_FOUND") {
        return jsonErr("NOT_FOUND", "Pacote não encontrado.", 404);
      }
      return jsonErr("UNKNOWN", "Falha ao cadastrar colaborador.", 500);
    }

    await createAuditLog({
      entityType: "EventCollaborator",
      entityId: result.ok.id,
      action: "COLLABORATOR_CREATED",
      diff: { code: result.ok.code, packageId: d.packageId, email: d.email },
      performedByUserId: auth.id,
    }).catch(() => null);

    return jsonOk(
      {
        collaborator: serializeCollaborator(
          await prisma.eventCollaborator.findUniqueOrThrow({
            where: { id: result.ok.id },
            include: {
              package: { select: { id: true, name: true, slug: true, departureDate: true } },
            },
          })
        ),
        emailWarning: "emailWarning" in result ? result.emailWarning : undefined,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao cadastrar colaborador.";
    if (msg.includes("Faixa de vouchers esgotada")) {
      return jsonErr("VOUCHER_RANGE_EXHAUSTED", msg, 409);
    }
    throw e;
  }
}
