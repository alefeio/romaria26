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
      package: { select: { id: true, name: true, slug: true, departureDate: true } },
    },
    orderBy: [{ package: { departureDate: "asc" } }, { name: "asc" }],
  });

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
    const key = v.packageId;
    let group = byPackage.get(key);
    if (!group) {
      group = {
        packageName: v.package.name,
        departureDate: v.package.departureDate,
        vouchers: [],
      };
      byPackage.set(key, group);
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
