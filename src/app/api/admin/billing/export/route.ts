import "server-only";

import { requireAdminApi } from "@/lib/api-admin-guard";
import { jsonErr } from "@/lib/http";
import { loadSalesReportData } from "@/lib/billing/sales-report-data";
import { buildSalesReportPdf, buildSalesReportXlsx } from "@/lib/billing/sales-report-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") ?? "").toLowerCase();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (format !== "pdf" && format !== "xlsx" && format !== "excel") {
      return jsonErr("VALIDATION_ERROR", "Informe format=pdf ou format=xlsx.", 400);
    }

    const data = await loadSalesReportData({ from, to });
    const stamp = new Date().toISOString().slice(0, 10);
    const rangePart =
      data.range.from || data.range.to
        ? `_${data.range.from ?? "inicio"}-${data.range.to ?? "hoje"}`
        : "_completo";

    if (format === "pdf") {
      const bytes = await buildSalesReportPdf(data);
      return new Response(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="faturamento-vendas${rangePart}_${stamp}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const xlsx = await buildSalesReportXlsx(data);
    return new Response(new Uint8Array(xlsx), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="faturamento-vendas${rangePart}_${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/admin/billing/export]", e);
    return jsonErr("BILLING_EXPORT_FAILED", "Não foi possível gerar o relatório.", 500);
  }
}
