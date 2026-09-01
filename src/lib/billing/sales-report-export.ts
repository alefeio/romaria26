import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import ExcelJS from "exceljs";

import type { SalesReportData } from "@/lib/billing/sales-report-data";
import { formatBrl, formatDateTimeBr } from "@/lib/billing/sales-report-data";

function periodLabel(data: SalesReportData): string {
  if (data.range.from && data.range.to) return `${data.range.from} a ${data.range.to}`;
  if (data.range.from) return `a partir de ${data.range.from}`;
  if (data.range.to) return `até ${data.range.to}`;
  return "Período completo";
}

/** Helvetica WinAnsi: remove accents unsupported by StandardFonts. */
function pdfSafe(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const raw = pdfSafe(text);
  if (font.widthOfTextAtSize(raw, size) <= maxWidth) return raw;
  let t = raw;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}...`;
}

type ColAlign = "left" | "right" | "center";

type TableColumn = {
  key: string;
  label: string;
  width: number;
  align?: ColAlign;
};

type TableRow = Record<string, string>;

export async function buildSalesReportPdf(data: SalesReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [841.89, 595.28]; // A4 landscape
  const marginX = 28;
  const marginY = 28;
  const tableWidth = pageSize[0] - marginX * 2;
  const rowH = 16;
  const headerH = 18;
  const cellPad = 4;
  const fontSize = 8;
  const headerSize = 8;

  let page = doc.addPage(pageSize);
  let y = page.getHeight() - marginY;

  const newPage = () => {
    page = doc.addPage(pageSize);
    y = page.getHeight() - marginY;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < marginY) newPage();
  };

  const drawPlain = (text: string, x: number, size: number, bold = false) => {
    page.drawText(pdfSafe(text), {
      x,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.12, 0.12, 0.14),
    });
  };

  const drawCellText = (
    text: string,
    cellX: number,
    cellY: number,
    cellW: number,
    cellHeight: number,
    align: ColAlign,
    bold: boolean
  ) => {
    const f = bold ? fontBold : font;
    const size = bold ? headerSize : fontSize;
    const clipped = truncateToWidth(text, f, size, cellW - cellPad * 2);
    const tw = f.widthOfTextAtSize(clipped, size);
    let x = cellX + cellPad;
    if (align === "right") x = cellX + cellW - cellPad - tw;
    if (align === "center") x = cellX + (cellW - tw) / 2;
    const textY = cellY + (cellHeight - size) / 2 - 1;
    page.drawText(clipped, {
      x,
      y: textY,
      size,
      font: f,
      color: rgb(0.12, 0.12, 0.14),
    });
  };

  const drawTableHeader = (cols: TableColumn[], startX: number, topY: number) => {
    let x = startX;
    page.drawRectangle({
      x: startX,
      y: topY - headerH,
      width: tableWidth,
      height: headerH,
      color: rgb(0.93, 0.94, 0.96),
      borderColor: rgb(0.75, 0.78, 0.82),
      borderWidth: 0.6,
    });
    for (const col of cols) {
      page.drawRectangle({
        x,
        y: topY - headerH,
        width: col.width,
        height: headerH,
        borderColor: rgb(0.75, 0.78, 0.82),
        borderWidth: 0.5,
      });
      drawCellText(col.label, x, topY - headerH, col.width, headerH, col.align ?? "left", true);
      x += col.width;
    }
    return topY - headerH;
  };

  const drawTableRow = (
    cols: TableColumn[],
    row: TableRow,
    startX: number,
    topY: number,
    zebra: boolean
  ) => {
    let x = startX;
    if (zebra) {
      page.drawRectangle({
        x: startX,
        y: topY - rowH,
        width: tableWidth,
        height: rowH,
        color: rgb(0.97, 0.98, 0.99),
      });
    }
    for (const col of cols) {
      page.drawRectangle({
        x,
        y: topY - rowH,
        width: col.width,
        height: rowH,
        borderColor: rgb(0.82, 0.84, 0.88),
        borderWidth: 0.4,
      });
      drawCellText(row[col.key] ?? "", x, topY - rowH, col.width, rowH, col.align ?? "left", false);
      x += col.width;
    }
    return topY - rowH;
  };

  const drawTable = (title: string, cols: TableColumn[], rows: TableRow[], emptyMessage: string) => {
    // Normalize widths to fill tableWidth
    const sumW = cols.reduce((a, c) => a + c.width, 0);
    const normalized = cols.map((c) => ({ ...c, width: (c.width / sumW) * tableWidth }));

    ensureSpace(36 + headerH + rowH);
    y -= 10;
    drawPlain(title, marginX, 11, true);
    y -= 16;

    if (rows.length === 0) {
      ensureSpace(rowH);
      drawPlain(emptyMessage, marginX, 9, false);
      y -= 14;
      return;
    }

    y = drawTableHeader(normalized, marginX, y);

    rows.forEach((row, idx) => {
      if (y - rowH < marginY) {
        newPage();
        y = drawTableHeader(normalized, marginX, y);
      }
      y = drawTableRow(normalized, row, marginX, y, idx % 2 === 1);
    });

    y -= 8;
  };

  // --- Header ---
  drawPlain("Relatorio completo de vendas - Romaria Fluvial", marginX, 14, true);
  y -= 18;
  drawPlain(`Periodo: ${periodLabel(data)}`, marginX, 9, false);
  y -= 12;
  drawPlain(`Gerado em: ${formatDateTimeBr(data.generatedAt)}`, marginX, 9, false);
  y -= 16;

  // --- Resumo (compact table) ---
  drawTable(
    "Resumo",
    [
      { key: "indicador", label: "Indicador", width: 3 },
      { key: "valor", label: "Valor", width: 2, align: "right" },
    ],
    [
      { indicador: "Reservas (nao canceladas)", valor: String(data.totals.reservationsCount) },
      { indicador: "Vouchers (total)", valor: String(data.totals.vouchers?.total ?? 0) },
      { indicador: "Vouchers - adultos", valor: String(data.totals.vouchers?.adults ?? 0) },
      { indicador: "Vouchers - criancas pagas (>= 6 anos)", valor: String(data.totals.vouchers?.paidChildren ?? 0) },
      { indicador: "Vouchers - criancas nao pagas (< 6 / cortesia)", valor: String(data.totals.vouchers?.unpaidChildren ?? 0) },
      { indicador: "Kits cafe da manha", valor: String(data.totals.vouchers?.kits ?? 0) },
      {
        indicador: "Camisas opcionais (criancas gratuitas)",
        valor: `${data.totals.vouchers?.optionalShirts ?? 0} / ${formatBrl(data.totals.vouchers?.optionalShirtsAmount ?? "0")}`,
      },
      { indicador: "Vendas (subtotal)", valor: formatBrl(data.totals.totalPrice) },
      { indicador: "Descontos concedidos", valor: formatBrl(data.totals.totalDiscount) },
      { indicador: "Vendas (valor final / devido)", valor: formatBrl(data.totals.totalDue) },
      { indicador: "Recebido (saldos das reservas)", valor: formatBrl(data.totals.totalPaid) },
      { indicador: "A receber", valor: formatBrl(data.totals.totalToReceive) },
      {
        indicador: "Pagamentos no periodo",
        valor: `${data.totals.paymentsCount} / ${formatBrl(data.totals.paymentsAmount)}`,
      },
      {
        indicador: "Parcelas em atraso",
        valor: `${data.totals.overdueCount} / ${formatBrl(data.totals.overdueAmount)}`,
      },
    ],
    "Sem dados."
  );

  drawTable(
    "Vendas (reservas)",
    [
      { key: "data", label: "Data", width: 1.35 },
      { key: "cliente", label: "Cliente", width: 2.2 },
      { key: "pacote", label: "Pacote", width: 2.1 },
      { key: "saida", label: "Saida", width: 0.9 },
      { key: "qtd", label: "Qtd", width: 0.45, align: "right" },
      { key: "devido", label: "Devido", width: 1.0, align: "right" },
      { key: "pago", label: "Pago", width: 1.0, align: "right" },
      { key: "receber", label: "A receber", width: 1.0, align: "right" },
      { key: "status", label: "Status", width: 0.85, align: "center" },
    ],
    data.reservations.map((r) => ({
      data: formatDateTimeBr(r.reservedAt),
      cliente: r.customerName,
      pacote: r.packageName,
      saida: r.packageDepartureDate,
      qtd: String(r.quantity),
      devido: formatBrl(r.totalDue),
      pago: formatBrl(r.totalPaid),
      receber: formatBrl(r.toReceive),
      status: r.paymentStatus,
    })),
    "Nenhuma reserva no periodo."
  );

  drawTable(
    "Pagamentos recebidos",
    [
      { key: "data", label: "Data", width: 1.4 },
      { key: "cliente", label: "Cliente", width: 2.4 },
      { key: "pacote", label: "Pacote", width: 2.4 },
      { key: "metodo", label: "Metodo", width: 1.1, align: "center" },
      { key: "valor", label: "Valor", width: 1.2, align: "right" },
      { key: "obs", label: "Obs.", width: 2.0 },
    ],
    data.payments.map((p) => ({
      data: formatDateTimeBr(p.paidAt),
      cliente: p.customerName,
      pacote: p.packageName,
      metodo: p.method,
      valor: formatBrl(p.amount),
      obs: p.note ?? "",
    })),
    "Nenhum pagamento no periodo."
  );

  drawTable(
    "Parcelas em atraso",
    [
      { key: "venc", label: "Vencimento", width: 1.1 },
      { key: "cliente", label: "Cliente", width: 2.3 },
      { key: "telefone", label: "Telefone", width: 1.3 },
      { key: "pacote", label: "Pacote", width: 2.2 },
      { key: "valor", label: "Valor parcela", width: 1.2, align: "right" },
      { key: "status", label: "Status", width: 0.9, align: "center" },
      { key: "devido", label: "Devido", width: 1.1, align: "right" },
      { key: "pago", label: "Pago", width: 1.1, align: "right" },
    ],
    data.overdue.map((o) => ({
      venc: o.dueDate,
      cliente: o.customerName,
      telefone: o.customerPhone,
      pacote: o.packageName,
      valor: formatBrl(o.amount),
      status: o.paymentStatus,
      devido: formatBrl(o.totalDue),
      pago: formatBrl(o.totalPaid),
    })),
    "Nenhuma parcela em atraso."
  );

  return doc.save();
}

function autosizeColumns(sheet: ExcelJS.Worksheet, min = 10, max = 48) {
  sheet.columns.forEach((col) => {
    let width = min;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      let text = "";
      if (v == null) text = "";
      else if (typeof v === "object" && v !== null && "text" in v) text = String((v as { text: string }).text ?? "");
      else if (typeof v === "object" && v !== null && "result" in v) text = String((v as { result?: unknown }).result ?? "");
      else text = String(v);
      width = Math.max(width, Math.min(max, text.length + 2));
    });
    col.width = width;
  });
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number, colCount: number) {
  const row = sheet.getRow(rowNumber);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  }
  row.height = 20;
}

function addNativeTable(
  sheet: ExcelJS.Worksheet,
  opts: {
    name: string;
    startRow: number;
    headers: string[];
    rows: Array<Array<string | number | null>>;
    moneyCols?: number[];
  }
) {
  const { name, startRow, headers, rows, moneyCols = [] } = opts;

  if (rows.length === 0) {
    const headerRow = sheet.getRow(startRow);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(sheet, startRow, headers.length);
    autosizeColumns(sheet);
    sheet.views = [{ state: "frozen", ySplit: startRow }];
    return;
  }

  const endRow = startRow + rows.length;
  sheet.addTable({
    name,
    ref: `A${startRow}`,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: headers.map((h) => ({ name: h, filterButton: true })),
    rows: rows.map((r) => r.map((v) => (v == null ? "" : v))),
  });

  // Cabeçalho e valores monetários
  styleHeaderRow(sheet, startRow, headers.length);
  for (let r = startRow + 1; r <= endRow; r++) {
    const row = sheet.getRow(r);
    for (const c of moneyCols) {
      const cell = row.getCell(c);
      if (typeof cell.value === "number") {
        cell.numFmt = '"R$"#,##0.00';
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }
    }
  }

  autosizeColumns(sheet);
  sheet.views = [{ state: "frozen", ySplit: startRow }];
}

export async function buildSalesReportXlsx(data: SalesReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Romaria Fluvial";
  wb.created = new Date();

  const resumo = wb.addWorksheet("Resumo", {
    properties: { defaultRowHeight: 18 },
  });
  resumo.getCell("A1").value = "Relatório completo de vendas — Romaria Fluvial";
  resumo.getCell("A1").font = { bold: true, size: 14 };
  resumo.mergeCells("A1:B1");
  resumo.getCell("A2").value = "Período";
  resumo.getCell("B2").value = periodLabel(data);
  resumo.getCell("A3").value = "Gerado em";
  resumo.getCell("B3").value = formatDateTimeBr(data.generatedAt);
  resumo.getCell("A2").font = { bold: true };
  resumo.getCell("A3").font = { bold: true };

  addNativeTable(resumo, {
    name: "TabelaResumo",
    startRow: 5,
    headers: ["Indicador", "Valor"],
    rows: [
      ["Reservas (não canceladas)", data.totals.reservationsCount],
      ["Vouchers (total)", data.totals.vouchers?.total ?? 0],
      ["Vouchers — adultos", data.totals.vouchers?.adults ?? 0],
      ["Vouchers — crianças pagas (≥ 6 anos)", data.totals.vouchers?.paidChildren ?? 0],
      ["Vouchers — crianças não pagas (< 6 / cortesia)", data.totals.vouchers?.unpaidChildren ?? 0],
      ["Kits café da manhã", data.totals.vouchers?.kits ?? 0],
      [
        "Camisas opcionais (crianças gratuitas)",
        `${data.totals.vouchers?.optionalShirts ?? 0} / ${Number(data.totals.vouchers?.optionalShirtsAmount ?? 0)}`,
      ],
      ["Vendas (subtotal)", Number(data.totals.totalPrice)],
      ["Descontos concedidos", Number(data.totals.totalDiscount)],
      ["Vendas (valor final / devido)", Number(data.totals.totalDue)],
      ["Recebido (saldos das reservas)", Number(data.totals.totalPaid)],
      ["A receber", Number(data.totals.totalToReceive)],
      ["Pagamentos no período (qtd)", data.totals.paymentsCount],
      ["Pagamentos no período (valor)", Number(data.totals.paymentsAmount)],
      ["Parcelas em atraso (qtd)", data.totals.overdueCount],
      ["Parcelas em atraso (valor)", Number(data.totals.overdueAmount)],
    ],
  });
  // Formatar valores monetários do resumo (linhas de dados da tabela)
  for (const r of [12, 13, 14, 15, 16, 18, 20]) {
    resumo.getCell(`B${r}`).numFmt = '"R$"#,##0.00';
  }
  // Congelar só o título no resumo (tabela começa na linha 5)
  resumo.views = [{ state: "frozen", ySplit: 4 }];

  const vendas = wb.addWorksheet("Vendas", { properties: { defaultRowHeight: 18 } });
  addNativeTable(vendas, {
    name: "TabelaVendas",
    startRow: 1,
    headers: [
      "Data reserva",
      "Cliente",
      "E-mail",
      "Telefone",
      "Pacote",
      "Saída",
      "Adultos",
      "Crianças",
      "Qtd",
      "Status reserva",
      "Status pagamento",
      "Devido",
      "Pago",
      "A receber",
      "Pref. pagamento",
      "ID reserva",
    ],
    rows: data.reservations.map((r) => [
      formatDateTimeBr(r.reservedAt),
      r.customerName,
      r.customerEmail,
      r.customerPhone,
      r.packageName,
      r.packageDepartureDate,
      r.adultsCount,
      r.childrenCount,
      r.quantity,
      r.status,
      r.paymentStatus,
      Number(r.totalDue),
      Number(r.totalPaid),
      Number(r.toReceive),
      r.paymentPreferenceMethod ?? "",
      r.id,
    ]),
    moneyCols: [12, 13, 14],
  });

  const pagamentos = wb.addWorksheet("Pagamentos", { properties: { defaultRowHeight: 18 } });
  addNativeTable(pagamentos, {
    name: "TabelaPagamentos",
    startRow: 1,
    headers: ["Data pagamento", "Cliente", "Pacote", "Método", "Valor", "Obs.", "ID reserva", "ID pagamento"],
    rows: data.payments.map((p) => [
      formatDateTimeBr(p.paidAt),
      p.customerName,
      p.packageName,
      p.method,
      Number(p.amount),
      p.note ?? "",
      p.reservationId,
      p.id,
    ]),
    moneyCols: [5],
  });

  const atrasos = wb.addWorksheet("Parcelas em atraso", { properties: { defaultRowHeight: 18 } });
  addNativeTable(atrasos, {
    name: "TabelaParcelasAtraso",
    startRow: 1,
    headers: [
      "Vencimento",
      "Cliente",
      "Telefone",
      "Pacote",
      "Valor parcela",
      "Status pgto reserva",
      "Devido",
      "Pago",
      "ID reserva",
    ],
    rows: data.overdue.map((o) => [
      o.dueDate,
      o.customerName,
      o.customerPhone,
      o.packageName,
      Number(o.amount),
      o.paymentStatus,
      Number(o.totalDue),
      Number(o.totalPaid),
      o.reservationId,
    ]),
    moneyCols: [5, 7, 8],
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
