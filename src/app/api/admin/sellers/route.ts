import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const items = await prisma.user.findMany({
    where: { role: "SELLER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, isActive: true },
  });

  return jsonOk({ items });
}
