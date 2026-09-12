import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type VoucherExportRow = {
  id: string;
  code: string;
  name: string;
  shirtSize: string;
  hasBreakfastKit: boolean;
  personType: "ADULT" | "CHILD";
};

export type VoucherExportPackageGroup = {
  packageName: string;
  departureDate: Date;
  vouchers: VoucherExportRow[];
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sortByNamePt(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
}

/** pdf-lib Helvetica (WinAnsi) não cobre alguns caracteres — remove para não quebrar o PDF. */
function pdfSafeText(input: string): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

type PageCursor = {
  page: PDFPage;
  y: number;
};

export async function buildVouchersListPdf(opts: {
  title: string;
  subtitle: string;
  groups: VoucherExportPackageGroup[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 42;
  const smallLineH = 12;

  const cursor: PageCursor = {
    page: doc.addPage(pageSize),
    y: pageSize[1] - margin,
  };

  function ensureSpace(needed: number) {
    if (cursor.y < margin + needed) {
      cursor.page = doc.addPage(pageSize);
      cursor.y = pageSize[1] - margin;
    }
  }

  function drawTextLine(
    text: string,
    optsDraw: { size: number; font: PDFFont; color: ReturnType<typeof rgb>; gapAfter: number }
  ) {
    ensureSpace(optsDraw.size + 8);
    cursor.page.drawText(pdfSafeText(text), {
      x: margin,
      y: cursor.y,
      size: optsDraw.size,
      font: optsDraw.font,
      color: optsDraw.color,
    });
    cursor.y -= optsDraw.gapAfter;
  }

  function renderSection(heading: string, rows: VoucherExportRow[]) {
    ensureSpace(40);
    drawTextLine(heading, { size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1), gapAfter: 18 });

    if (rows.length === 0) {
      drawTextLine("—", { size: 10, font, color: rgb(0.35, 0.35, 0.35), gapAfter: 18 });
      return;
    }

    for (const r of rows) {
      const text = `${r.name}  •  Camisa: ${r.shirtSize}  •  Codigo: ${r.code}`;
      drawTextLine(text, { size: 10, font, color: rgb(0, 0, 0), gapAfter: smallLineH + 2 });
    }

    cursor.y -= 10;
  }

  drawTextLine(opts.title, { size: 16, font: fontBold, color: rgb(0, 0, 0), gapAfter: 22 });
  drawTextLine(opts.subtitle, { size: 10, font, color: rgb(0.2, 0.2, 0.2), gapAfter: 18 });

  const showPackageHeadings = opts.groups.length > 1;

  for (const group of opts.groups) {
    if (showPackageHeadings) {
      ensureSpace(56);
      drawTextLine(`${group.packageName} (${ymd(group.departureDate)})`, {
        size: 13,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
        gapAfter: 16,
      });
    }

    const adultsWithKit = group.vouchers
      .filter((v) => v.personType === "ADULT" && v.hasBreakfastKit)
      .sort(sortByNamePt);
    const adultsNoKit = group.vouchers
      .filter((v) => v.personType === "ADULT" && !v.hasBreakfastKit)
      .sort(sortByNamePt);
    const children = group.vouchers.filter((v) => v.personType === "CHILD").sort(sortByNamePt);

    renderSection(`Adultos com kit (${adultsWithKit.length})`, adultsWithKit);
    renderSection(`Adultos sem kit (${adultsNoKit.length})`, adultsNoKit);
    renderSection(`Crianças (${children.length})`, children);
  }

  return doc.save();
}
