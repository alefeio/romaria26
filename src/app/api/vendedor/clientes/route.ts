import { prisma } from "@/lib/prisma";
import { requireSellerApi } from "@/lib/api-admin-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { hashPassword } from "@/lib/auth";
import { generateTempPassword } from "@/lib/password";
import { createAuditLog } from "@/lib/audit";
import { generateCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";
import { sellerCustomerCreateSchema } from "@/lib/validators/seller";

function digits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export async function GET(request: Request) {
  const auth = await requireSellerApi();
  if (auth instanceof Response) return auth;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const digitsQ = digits(q);
  if (q.length < 2 && digitsQ.length < 8) {
    return jsonOk({ items: [] as const });
  }

  const or: object[] = [];
  if (q.length >= 2) {
    or.push({ name: { contains: q, mode: "insensitive" as const } });
    or.push({ email: { contains: q, mode: "insensitive" as const } });
  }
  if (digitsQ.length >= 8) {
    or.push({ phone: { contains: digitsQ } });
    or.push({ cpf: { contains: digitsQ } });
  }

  const items = await prisma.user.findMany({
    where: { role: "CUSTOMER", isActive: true, OR: or },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, email: true, phone: true, cpf: true },
  });

  return jsonOk({ items });
}

export async function POST(request: Request) {
  const auth = await requireSellerApi();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = sellerCustomerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const d = parsed.data;
  const phone = d.phone;
  const cpf = d.cpf;

  if (cpf) {
    const byCpf = await prisma.user.findFirst({
      where: { role: "CUSTOMER", cpf },
      select: { id: true, name: true, email: true, phone: true, cpf: true, isActive: true },
    });
    if (byCpf) {
      if (!byCpf.isActive) return jsonErr("INACTIVE_CUSTOMER", "Já existe um cliente inativo com este CPF.", 409);
      return jsonOk({ item: byCpf, reused: true });
    }
  }

  const byPhone = await prisma.user.findFirst({
    where: { role: "CUSTOMER", phone },
    select: { id: true, name: true, email: true, phone: true, cpf: true, isActive: true },
  });
  if (byPhone) {
    if (!byPhone.isActive) return jsonErr("INACTIVE_CUSTOMER", "Já existe um cliente inativo com este WhatsApp.", 409);
    return jsonOk({ item: byPhone, reused: true });
  }

  const email = d.email.trim() ? d.email.trim().toLowerCase() : generateCustomerPlaceholderEmail();
  const existingEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true, name: true, email: true, phone: true, cpf: true },
  });
  if (existingEmail) {
    if (existingEmail.role !== "CUSTOMER") {
      return jsonErr("EMAIL_IN_USE", "Este e-mail já existe e não é de cliente.", 409);
    }
    if (!existingEmail.isActive) {
      return jsonErr("INACTIVE_CUSTOMER", "Este cliente está inativo.", 400);
    }
    return jsonOk({ item: existingEmail, reused: true });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const created = await prisma.user.create({
    data: {
      name: d.name.trim(),
      email,
      phone,
      cpf,
      passwordHash,
      role: "CUSTOMER",
      isActive: true,
      mustChangePassword: true,
      isAdmin: false,
    },
    select: { id: true, name: true, email: true, phone: true, cpf: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: created.id,
    action: "CUSTOMER_CREATED",
    diff: { created: { id: created.id, email: created.email, role: "CUSTOMER", via: "SELLER" } },
    performedByUserId: auth.id,
  });

  return jsonOk({ item: created, reused: false }, { status: 201 });
}
