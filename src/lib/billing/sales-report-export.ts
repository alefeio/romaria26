import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

import type { SalesReportData } from "@/lib/billing/sales-report-data";
import { formatBrl, formatDateTimeBr } from "@/lib/billing/sales-report-data";

function periodLabel(data: SalesReportData): string {
  if (data.range.from && data.range.to) return `${data.range.from} a ${data.range.to}`;
  if (data.range.from) return `a partir de ${data.range.from}`;
  if (data.range.to) return `até ${data.range.to}`;
  return "Período completo";
}

export async function buildSalesReportPdf(data: SalesReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [841.89, 595.28]; // A4 landscape
  const margin = 36;
  const lineH = 12;
  let page = doc.addPage(pageSize);
  let y = page.getHeight() - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage(pageSize);
      y = page.getHeight() - margin;
    }
  };

  const drawText = (text: string, x: number, size = 9, bold = false) => {
    const f = bold ? fontBold : font;
    const safe = text.replace(/[^\x00-\x7F]/g, (ch) => {
      // pdf-lib StandardFonts: keep ASCII; map common PT accents roughly
      const map: Record<string, string> = {
        á: "a",
        à: "a",
        ã: "a",
        â: "a",
        é: "e",
        ê: "e",
        í: "i",
        ó: "o",
        õ: "o",
        ô: "o",
        ú: "u",
        ç: "c",
        Á: "A",
        À: "A",
        Ã: "A",
        Â: "A",
        É: "E",
        Ê: "E",
        Í: "I",
        Ó: "O",
        Õ: "O",
        Ô: "O",
        Ú: "U",
        Ç: "C",
      };
      return map[ch] ?? "?";
    });
    page.drawText(safe, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  };

  const sectionTitle = (title: string) => {
    ensureSpace(28);
    y -= 8;
    drawText(title, margin, 12, true);
    y -= 16;
  };

  drawText("Relatorio completo de vendas — Romaria Fluvial", margin, 14, true);
  y -= 16;
  drawText(`Periodo: ${periodLabel(data)}`, margin, 9);
  y -= lineH;
  drawText(`Gerado em: ${formatDateTimeBr(data.generatedAt)}`, margin, 9);
  y -= 18;

  sectionTitle("Resumo");
  const summaryLines = [
    `Reservas (nao canceladas): ${data.totals.reservationsCount}`,
    `Vendas (devido): ${formatBrl(data.totals.totalDue)}`,
    `Recebido (saldos das reservas): ${formatBrl(data.totals.totalPaid)}`,
    `A receber: ${formatBrl(data.totals.totalToReceive)}`,
    `Pagamentos no periodo: ${data.totals.paymentsCount} · ${formatBrl(data.totals.paymentsAmount)}`,
    `Parcelas em atraso: ${data.totals.overdueCount} · ${formatBrl(data.totals.overdueAmount)}`,
  ];
  for (const line of summaryLines) {
    ensureSpace(lineH + 2);
    drawText(line, margin, 9);
    y -= lineH;
  }

  sectionTitle("Vendas (reservas)");
  const saleHeader =
    "Data             Cliente                      Pacote                     Qtd   Devido        Pago          Status";
  ensureSpace(lineH + 2);
  drawText(saleHeader, margin, 8, true);
  y -= lineH;
  for (const r of data.reservations) {
    ensureSpace(lineH + 2);
    const date = formatDateTimeBr(r.reservedAt).padEnd(16).slice(0, 16);
    const cliente = r.customerName.padEnd(28).slice(0, 28);
    const pacote = r.packageName.padEnd(26).slice(0, 26);
    const qtd = String(r.quantity).padStart(3);
    const devido = formatBrl(r.totalDue).padStart(12);
    const pago = formatBrl(r.totalPaid).padStart(12);
    const status = r.paymentStatus.padEnd(8).slice(0, 8);
    drawText(`${date} ${cliente} ${pacote} ${qtd}  ${devido}  ${pago}  ${status}`, margin, 7);
    y -= lineH;
  }
  if (data.reservations.length === 0) {
    ensureSpace(lineH);
    drawText("Nenhuma reserva no periodo.", margin, 9);
    y -= lineH;
  }

  sectionTitle("Pagamentos recebidos");
  ensureSpace(lineH + 2);
  drawText(
    "Data             Cliente                      Pacote                     Metodo     Valor",
    margin,
    8,
    true
  );
  y -= lineH;
  for (const p of data.payments) {
    ensureSpace(lineH + 2);
    const date = formatDateTimeBr(p.paidAt).padEnd(16).slice(0, 16);
    const cliente = p.customerName.padEnd(28).slice(0, 28);
    const pacote = p.packageName.padEnd(26).slice(0, 26);
    const method = p.method.padEnd(10).slice(0, 10);
    const valor = formatBrl(p.amount).padStart(12);
    drawText(`${date} ${cliente} ${pacote} ${method} ${valor}`, margin, 7);
    y -= lineH;
  }
  if (data.payments.length === 0) {
    ensureSpace(lineH);
    drawText("Nenhum pagamento no periodo.", margin, 9);
    y -= lineH;
  }

  sectionTitle("Parcelas em atraso");
  ensureSpace(lineH + 2);
  drawText("Vencimento   Cliente                      Pacote                     Valor         Status", margin, 8, true);
  y -= lineH;
  for (const o of data.overdue) {
    ensureSpace(lineH + 2);
    const due = o.dueDate.padEnd(12).slice(0, 12);
    const cliente = o.customerName.padEnd(28).slice(0, 28);
    const pacote = o.packageName.padEnd(26).slice(0, 26);
    const valor = formatBrl(o.amount).padStart(12);
    const status = o.paymentStatus.padEnd(8).slice(0, 8);
    drawText(`${due} ${cliente} ${pacote} ${valor}  ${status}`, margin, 7);
    y -= lineH;
  }
  if (data.overdue.length === 0) {
    ensureSpace(lineH);
    drawText("Nenhuma parcela em atraso.", margin, 9);
    y -= lineH;
  }

  return doc.save();
}

export function buildSalesReportXlsx(data: SalesReportData): Buffer {
  const wb = XLSX.utils.book_new();

  const resumo = [
    ["Relatório completo de vendas — Romaria Fluvial"],
    ["Período", periodLabel(data)],
    ["Gerado em", formatDateTimeBr(data.generatedAt)],
    [],
    ["Indicador", "Valor"],
    ["Reservas (não canceladas)", data.totals.reservationsCount],
    ["Vendas (devido)", Number(data.totals.totalDue)],
    ["Recebido (saldos das reservas)", Number(data.totals.totalPaid)],
    ["A receber", Number(data.totals.totalToReceive)],
    ["Pagamentos no período (qtd)", data.totals.paymentsCount],
    ["Pagamentos no período (valor)", Number(data.totals.paymentsAmount)],
    ["Parcelas em atraso (qtd)", data.totals.overdueCount],
    ["Parcelas em atraso (valor)", Number(data.totals.overdueAmount)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

  const vendas = [
    [
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
    ...data.reservations.map((r) => [
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
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vendas), "Vendas");

  const pagamentos = [
    ["Data pagamento", "Cliente", "Pacote", "Método", "Valor", "Obs.", "ID reserva", "ID pagamento"],
    ...data.payments.map((p) => [
      formatDateTimeBr(p.paidAt),
      p.customerName,
      p.packageName,
      p.method,
      Number(p.amount),
      p.note ?? "",
      p.reservationId,
      p.id,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pagamentos), "Pagamentos");

  const atrasos = [
    ["Vencimento", "Cliente", "Telefone", "Pacote", "Valor parcela", "Status pgto reserva", "Devido", "Pago", "ID reserva"],
    ...data.overdue.map((o) => [
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
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(atrasos), "Parcelas em atraso");

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(out);
}
