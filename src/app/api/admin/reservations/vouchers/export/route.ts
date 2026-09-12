import "server-only";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { buildVouchersListPdf } from "@/lib/vouchers/vouchers-list-pdf";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const onlyNotExported = searchParams.get("onlyNotExported") === "1" || searchParams.get("onlyNotExported") === "true";

  const now = new Date();

  const vouchers = await prisma.reservationVoucher.findMany({
    where: {
      voidedAt: null,
      ...(onlyNotExported ? { exportedAt: null } : {}),
      reservation: { status: { not: "CANCELLED" } },
    },
    select: {
      id: true,
      code: true,
      name: true,
      shirtSize: true,
      hasBreakfastKit: true,
      personType: true,
      packageId: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const packageIds = Array.from(new Set(vouchers.map((v) => v.packageId)));
  const packages = packageIds.length
    ? await prisma.package.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, name: true, departureDate: true },
      })
    : [];
  const packageById = new Map(packages.map((p) => [p.id, p]));

  const byPackage = new Map<
    string,
    {
      packageName: string;
      departureDate: Date;
      vouchers: {
        id: string;
        code: string;
        name: string;
        shirtSize: string;
        hasBreakfastKit: boolean;
        personType: "ADULT" | "CHILD";
      }[];
    }
  >();

  for (const v of vouchers) {
    const pkg = packageById.get(v.packageId);
    if (!pkg) continue;

    let group = byPackage.get(v.packageId);
    if (!group) {
      group = {
        packageName: pkg.name,
        departureDate: pkg.departureDate,
        vouchers: [],
      };
      byPackage.set(v.packageId, group);
    }
    group.vouchers.push({
      id: v.id,
      code: v.code,
      name: v.name,
      shirtSize: v.shirtSize,
      hasBreakfastKit: v.hasBreakfastKit,
      personType: v.personType,
    });
  }

  const groups = Array.from(byPackage.values()).sort(
    (a, b) => a.departureDate.getTime() - b.departureDate.getTime() || a.packageName.localeCompare(b.packageName, "pt-BR")
  );

  const pdfBytes = await buildVouchersListPdf({
    title: "Lista de vouchers — Todos os pacotes",
    subtitle: `Exportado em: ${now.toLocaleString("pt-BR")} • Filtro: ${
      onlyNotExported ? "Somente não exportados" : "Todos"
    } • Pacotes: ${groups.length}`,
    groups,
  });

  const idsToMark = vouchers.map((v) => v.id);
  if (idsToMark.length) {
    await prisma.reservationVoucher.updateMany({
      where: { id: { in: idsToMark }, exportedAt: null },
      data: { exportedAt: now, exportedByUserId: auth.id },
    });
  }

  const filename = `lista-vouchers-todos-${ymd(now)}.pdf`;
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
