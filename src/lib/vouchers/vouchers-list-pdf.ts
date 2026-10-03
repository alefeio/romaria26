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

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const raw = pdfSafeText(text);
  if (font.widthOfTextAtSize(raw, size) <= maxWidth) return raw;
  let t = raw;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}...`;
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
  const margin = 36;
  const tableWidth = pageSize[0] - margin * 2;
  const rowH = 14;
  const headerH = 16;
  const fontSize = 9;
  const cellPad = 3;

  /** Nome | Camisa | Kit cafe | Codigo */
  const cols = [
    { key: "name", label: "Nome no ingresso", width: tableWidth * 0.48 },
    { key: "shirt", label: "Camisa", width: tableWidth * 0.14 },
    { key: "kit", label: "Kit cafe", width: tableWidth * 0.16 },
    { key: "code", label: "Codigo", width: tableWidth * 0.22 },
  ] as const;

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

  function drawCell(
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    bold: boolean,
    align: "left" | "center" = "left"
  ) {
    const f = bold ? fontBold : font;
    const clipped = truncateToWidth(text, f, fontSize, w - cellPad * 2);
    const tw = f.widthOfTextAtSize(clipped, fontSize);
    let tx = x + cellPad;
    if (align === "center") tx = x + (w - tw) / 2;
    cursor.page.drawText(clipped, {
      x: tx,
      y: y + (h - fontSize) / 2 - 1,
      size: fontSize,
      font: f,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  function drawTableHeader() {
    ensureSpace(headerH + 4);
    const top = cursor.y;
    cursor.page.drawRectangle({
      x: margin,
      y: top - headerH,
      width: tableWidth,
      height: headerH,
      color: rgb(0.93, 0.94, 0.96),
      borderColor: rgb(0.7, 0.72, 0.76),
      borderWidth: 0.5,
    });
    let x = margin;
    for (const col of cols) {
      cursor.page.drawRectangle({
        x,
        y: top - headerH,
        width: col.width,
        height: headerH,
        borderColor: rgb(0.7, 0.72, 0.76),
        borderWidth: 0.4,
      });
      drawCell(col.label, x, top - headerH, col.width, headerH, true, col.key === "name" ? "left" : "center");
      x += col.width;
    }
    cursor.y = top - headerH;
  }

  function drawTableRow(r: VoucherExportRow, zebra: boolean) {
    ensureSpace(rowH + 2);
    if (cursor.y - rowH < margin) {
      cursor.page = doc.addPage(pageSize);
      cursor.y = pageSize[1] - margin;
      drawTableHeader();
    }
    const top = cursor.y;
    if (zebra) {
      cursor.page.drawRectangle({
        x: margin,
        y: top - rowH,
        width: tableWidth,
        height: rowH,
        color: rgb(0.97, 0.98, 0.99),
      });
    }
    const kitLabel =
      r.personType === "ADULT" ? (r.hasBreakfastKit ? "Sim" : "Nao") : "-";
    const values = [r.name, r.shirtSize || "-", kitLabel, r.code];
    let x = margin;
    cols.forEach((col, i) => {
      cursor.page.drawRectangle({
        x,
        y: top - rowH,
        width: col.width,
        height: rowH,
        borderColor: rgb(0.82, 0.84, 0.88),
        borderWidth: 0.35,
      });
      drawCell(values[i] ?? "", x, top - rowH, col.width, rowH, false, col.key === "name" ? "left" : "center");
      x += col.width;
    });
    cursor.y = top - rowH;
  }

  function renderSection(heading: string, rows: VoucherExportRow[]) {
    ensureSpace(headerH + rowH * 2 + 28);
    drawTextLine(heading, { size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1), gapAfter: 10 });

    if (rows.length === 0) {
      drawTextLine("- nenhum -", { size: 10, font, color: rgb(0.35, 0.35, 0.35), gapAfter: 14 });
      return;
    }

    drawTableHeader();
    rows.forEach((r, idx) => drawTableRow(r, idx % 2 === 1));
    cursor.y -= 12;
  }

  drawTextLine(opts.title, { size: 16, font: fontBold, color: rgb(0, 0, 0), gapAfter: 14 });
  drawTextLine(opts.subtitle, { size: 10, font, color: rgb(0.2, 0.2, 0.2), gapAfter: 10 });
  drawTextLine(
    "Kit cafe: coluna por ingresso (Sim/Nao nos adultos; crianças = -).",
    { size: 9, font, color: rgb(0.25, 0.25, 0.3), gapAfter: 16 }
  );

  const showPackageHeadings = opts.groups.length > 1;

  for (const group of opts.groups) {
    if (showPackageHeadings) {
      ensureSpace(56);
      drawTextLine(`${group.packageName} (${ymd(group.departureDate)})`, {
        size: 13,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
        gapAfter: 12,
      });
    }

    const adultsWithKit = group.vouchers
      .filter((v) => v.personType === "ADULT" && v.hasBreakfastKit)
      .sort(sortByNamePt);
    const adultsNoKit = group.vouchers
      .filter((v) => v.personType === "ADULT" && !v.hasBreakfastKit)
      .sort(sortByNamePt);
    const children = group.vouchers.filter((v) => v.personType === "CHILD").sort(sortByNamePt);

    renderSection(`Adultos COM kit cafe (${adultsWithKit.length})`, adultsWithKit);
    renderSection(`Adultos SEM kit cafe (${adultsNoKit.length})`, adultsNoKit);
    renderSection(`Criancas (${children.length})`, children);
  }

  return doc.save();
}
