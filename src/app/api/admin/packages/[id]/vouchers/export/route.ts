import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr } from "@/lib/http";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sortByNamePt(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
}

type VoucherRow = {
  id: string;
  code: string;
  name: string;
  shirtSize: string;
  hasBreakfastKit: boolean;
  personType: "ADULT" | "CHILD";
  exportedAt: Date | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return jsonErr("VALIDATION_ERROR", "id inválido.", 400);
  }

  const { searchParams } = new URL(request.url);
  const onlyNotExported = searchParams.get("onlyNotExported") === "1" || searchParams.get("onlyNotExported") === "true";

  const pkg = await prisma.package.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, departureDate: true },
  });
  if (!pkg) {
    return jsonErr("NOT_FOUND", "Pacote não encontrado.", 404);
  }

  const now = new Date();

  const vouchers = await prisma.reservationVoucher.findMany({
    where: {
      packageId: id,
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
      exportedAt: true,
    },
  });

  const adultsWithKit = vouchers
    .filter((v) => v.personType === "ADULT" && v.hasBreakfastKit)
    .sort(sortByNamePt);
  const adultsNoKit = vouchers
    .filter((v) => v.personType === "ADULT" && !v.hasBreakfastKit)
    .sort(sortByNamePt);
  const children = vouchers.filter((v) => v.personType === "CHILD").sort(sortByNamePt);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 42;
  const lineH = 14;
  const smallLineH = 12;

  const title = `Lista de vouchers — ${pkg.name}`;
  const subtitle = `Data: ${ymd(pkg.departureDate)} • Exportado em: ${now.toLocaleString("pt-BR")} • Filtro: ${
    onlyNotExported ? "Somente não exportados" : "Todos"
  }`;

  function renderSection(
    page: any,
    cursor: { y: number },
    heading: string,
    rows: VoucherRow[]
  ) {
    const startY = cursor.y;
    page.drawText(heading, { x: margin, y: startY, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    cursor.y -= 18;

    if (rows.length === 0) {
      page.drawText("—", { x: margin, y: cursor.y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
      cursor.y -= 18;
      return;
    }

    for (const r of rows) {
      const text = `${r.name}  •  Camisa: ${r.shirtSize}  •  Código: ${r.code}`;
      if (cursor.y < margin + 40) {
        const newPage = doc.addPage(pageSize);
        page = newPage;
        cursor.y = pageSize[1] - margin;
      }
      page.drawText(text, { x: margin, y: cursor.y, size: 10, font, color: rgb(0, 0, 0) });
      cursor.y -= smallLineH + 2;
    }

    cursor.y -= 10;
  }

  // page 1 header
  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;
  page.drawText(title, { x: margin, y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
  y -= 22;
  page.drawText(subtitle, { x: margin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 18;

  const cursor = { y };
  renderSection(page, cursor, `Adultos com kit (${adultsWithKit.length})`, adultsWithKit as VoucherRow[]);
  renderSection(page, cursor, `Adultos sem kit (${adultsNoKit.length})`, adultsNoKit as VoucherRow[]);
  renderSection(page, cursor, `Crianças (${children.length})`, children as VoucherRow[]);

  // Mark exported (only those included)
  const idsToMark = vouchers.map((v) => v.id);
  if (idsToMark.length) {
    await prisma.reservationVoucher.updateMany({
      where: { id: { in: idsToMark }, exportedAt: null },
      data: { exportedAt: now, exportedByUserId: auth.id },
    });
  }

  const pdfBytes = await doc.save();
  const filename = `lista-vouchers-${pkg.slug || "pacote"}-${ymd(pkg.departureDate)}.pdf`;
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

