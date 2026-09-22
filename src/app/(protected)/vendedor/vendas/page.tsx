"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type SaleRow = {
  id: string;
  customerName: string;
  customerPhone: string;
  quantity: number;
  adultsCount: number;
  childrenCount: number;
  kitCount: number;
  totalDue: string;
  paymentStatus: string;
  status: string;
  paymentMethodLabel: string;
  soldAt: string;
  packageName: string;
  departureDateLabel: string;
};

function brl(value: string): string {
  const n = Number.parseFloat(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VendedorVendasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SaleRow[]>([]);
  const [summary, setSummary] = useState({ salesCount: 0, tickets: 0, totalCharged: "0" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vendedor/vendas");
      const json = (await res.json()) as ApiResponse<{
        items: SaleRow[];
        summary: { salesCount: number; tickets: number; totalCharged: string };
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar vendas.");
        return;
      }
      setItems(json.data.items);
      setSummary(json.data.summary);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Minhas vendas</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Somente o que você lançou neste usuário.</p>
        </div>
        <Link href="/vendedor">
          <Button>Nova venda</Button>
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <p className="text-xs uppercase text-[var(--text-muted)]">Vendas pagas</p>
          <p className="mt-1 text-2xl font-semibold">{summary.salesCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <p className="text-xs uppercase text-[var(--text-muted)]">Ingressos</p>
          <p className="mt-1 text-2xl font-semibold">{summary.tickets}</p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <p className="text-xs uppercase text-[var(--text-muted)]">Total recebido</p>
          <p className="mt-1 text-2xl font-semibold">{brl(summary.totalCharged)}</p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <div className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>Quando</Th>
                <Th>Cliente</Th>
                <Th>Pacote</Th>
                <Th>Qtd</Th>
                <Th>Valor</Th>
                <Th>Pagamento</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap text-xs">{new Date(r.soldAt).toLocaleString("pt-BR")}</Td>
                  <Td>
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.customerPhone}</div>
                  </Td>
                  <Td>
                    <div>{r.packageName}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.departureDateLabel}</div>
                  </Td>
                  <Td>
                    {r.quantity}
                    {r.kitCount ? <span className="block text-xs text-[var(--text-muted)]">{r.kitCount} kit</span> : null}
                  </Td>
                  <Td>{brl(r.totalDue)}</Td>
                  <Td>
                    <Badge tone={r.paymentStatus === "PAID" ? "green" : "amber"}>{r.paymentMethodLabel || r.paymentStatus}</Badge>
                  </Td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <Td colSpan={6}>Nenhuma venda lançada ainda.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
