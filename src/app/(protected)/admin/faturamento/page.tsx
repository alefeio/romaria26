"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Billing = {
  range: { from: string | null; to: string | null };
  totals: { reservationsCount: number; totalDue: string; totalPaid: string; totalToReceive: string };
  overdue: {
    count: number;
    totalAmount: string;
    items: {
      id: string;
      reservationId: string;
      dueDate: string;
      amount: string;
      reservation: {
        id: string;
        customerNameSnapshot: string;
        customerPhoneSnapshot: string;
        paymentStatus: string;
        totalDue: string;
        totalPaid: string;
        package: { id: string; name: string; slug: string; departureDate: string };
      };
    }[];
  };
};

function brl(v: string): string {
  return (Number.parseFloat(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminFaturamentoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Billing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/billing/summary${qs}`, {
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const raw = await res.text();
      let json: ApiResponse<Billing>;
      try {
        json = raw ? (JSON.parse(raw) as ApiResponse<Billing>) : { ok: false, error: { code: "EMPTY", message: "Resposta vazia." } };
      } catch {
        setData(null);
        setLoadError("Resposta inválida do servidor. Tente atualizar a página.");
        toast.push("error", "Não foi possível ler o faturamento.");
        return;
      }
      if (!res.ok || !json.ok) {
        const msg = json.ok === false ? json.error.message : `Erro HTTP ${res.status}`;
        setData(null);
        setLoadError(msg);
        toast.push("error", msg);
        return;
      }
      if (!json.data) {
        setData(null);
        setLoadError("Dados do faturamento ausentes na resposta.");
        return;
      }
      setData(json.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha de rede ao carregar faturamento.";
      setData(null);
      setLoadError(msg);
      toast.push("error", msg);
    } finally {
      setLoading(false);
    }
  }, [qs, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Faturamento</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Vendas (devido), pagamentos recebidos e parcelas em atraso.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">De (AAAA-MM-DD)</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Até (AAAA-MM-DD)</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={() => void load()} className="w-full">
            Aplicar filtro
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-[var(--text-secondary)]">Carregando…</p>
      ) : loadError && !data ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
          <p className="font-medium">Não foi possível exibir o faturamento</p>
          <p className="mt-1 opacity-90">{loadError}</p>
          <Button type="button" className="mt-3" variant="secondary" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </div>
      ) : !data ? (
        <p className="mt-6 text-[var(--text-secondary)]">Sem dados.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="card">
              <div className="card-header">Reservas</div>
              <div className="card-body text-sm">
                <div className="text-2xl font-semibold text-[var(--text-primary)]">
                  {data.totals.reservationsCount ?? 0}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Não canceladas{data.range.from || data.range.to ? " (período filtrado)" : " (geral)"}</div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">Vendas (devido)</div>
              <div className="card-body text-sm">
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{brl(data.totals.totalDue ?? "0")}</div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">Recebido</div>
              <div className="card-body text-sm">
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{brl(data.totals.totalPaid ?? "0")}</div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">A receber</div>
              <div className="card-body text-sm">
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{brl(data.totals.totalToReceive ?? "0")}</div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="parcelas-atraso" className="text-lg font-semibold text-[var(--text-primary)] scroll-mt-20">
                Parcelas em atraso
              </h2>
              {(data.overdue?.count ?? 0) > 0 ? (
                <Badge tone="amber">
                  {data.overdue?.count} · {brl(data.overdue?.totalAmount ?? "0")}
                </Badge>
              ) : (
                <Badge tone="green">Nenhuma</Badge>
              )}
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Vencimento</Th>
                  <Th>Cliente</Th>
                  <Th>Pacote</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {(data.overdue?.items ?? []).map((i) => (
                  <tr key={i.id}>
                    <Td className="text-xs">{i.dueDate}</Td>
                    <Td>
                      <div className="font-medium">{i.reservation?.customerNameSnapshot}</div>
                      <div className="text-xs text-[var(--text-muted)]">{i.reservation?.customerPhoneSnapshot}</div>
                    </Td>
                    <Td>
                      <div className="font-medium">{i.reservation?.package?.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">Saída {i.reservation?.package?.departureDate}</div>
                    </Td>
                    <Td className="text-right">{brl(i.amount)}</Td>
                    <Td>
                      <Badge
                        tone={
                          i.reservation?.paymentStatus === "PAID"
                            ? "green"
                            : i.reservation?.paymentStatus === "PARTIAL"
                              ? "amber"
                              : "zinc"
                        }
                      >
                        {i.reservation?.paymentStatus}
                      </Badge>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {brl(i.reservation?.totalPaid ?? "0")} / {brl(i.reservation?.totalDue ?? "0")}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <a
                        className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                        href={`/admin/reservas/${i.reservationId}/pagamentos`}
                      >
                        Abrir
                      </a>
                    </Td>
                  </tr>
                ))}
                {(data.overdue?.items?.length ?? 0) === 0 ? (
                  <tr>
                    <Td colSpan={6} className="py-10 text-center text-[var(--text-muted)]">
                      Nenhuma parcela em atraso.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

