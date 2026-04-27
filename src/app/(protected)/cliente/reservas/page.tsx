"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Row = {
  id: string;
  quantity: number;
  includesBreakfastKit: boolean;
  totalPrice: string;
  paymentStatus: string;
  status: string;
  reservedAt: string;
  confirmedAt: string | null;
  package: { name: string; slug: string; departureDate: string; departureTime: string; boardingLocation: string };
  vouchers: {
    id: string;
    code: string;
    personType: string;
    personIndex: number;
    name: string;
    age: number | null;
    shirtSize: string;
    hasBreakfastKit: boolean;
    usedAt: string | null;
  }[];
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
};

export default function ClienteReservasPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/reservations");
      const json = (await res.json()) as ApiResponse<{ items: Row[] }>;
      if (!res.ok || !json.ok) {
        setErr(!json.ok ? json.error.message : "Não foi possível carregar.");
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Minhas reservas</h1>
      <p className="mt-2 text-[var(--text-secondary)]">Acompanhe o status das suas solicitações de passeio.</p>
      <div className="mt-4">
        <Link href="/passeios">
          <Button variant="secondary" size="sm">
            Ver passeios disponíveis
          </Button>
        </Link>
      </div>

      {err ? <p className="mt-6 text-red-600 dark:text-red-400">{err}</p> : null}

      {loading ? (
        <p className="mt-6 text-[var(--text-secondary)]">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-[var(--text-secondary)]">Você ainda não tem reservas.</p>
      ) : (
        <div className="mt-8">
          <Table>
            <thead>
              <tr>
                <Th>Pacote</Th>
                <Th>Saída</Th>
                <Th>Qtd</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th>Solicitado em</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <Td>
                      <Link href={`/passeios/${r.package.slug}`} className="font-medium text-[var(--igh-primary)] hover:underline">
                        {r.package.name}
                      </Link>
                    </Td>
                    <Td className="text-xs">
                      {r.package.departureDate} {r.package.departureTime}
                      <div className="text-[var(--text-muted)]">{r.package.boardingLocation}</div>
                    </Td>
                    <Td>
                      {r.quantity}
                      {r.includesBreakfastKit ? <span className="block text-xs text-[var(--text-muted)]">com kit café</span> : null}
                    </Td>
                    <Td>
                      {Number.parseFloat(r.totalPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </Td>
                    <Td>
                      <Badge tone={r.status === "CONFIRMED" ? "green" : r.status === "CANCELLED" ? "red" : "amber"}>
                        {statusLabel[r.status] ?? r.status}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-[var(--text-muted)]">
                      {new Date(r.reservedAt).toLocaleString("pt-BR")}
                    </Td>
                  </tr>
                  {r.vouchers?.length ? (
                    <tr>
                      <Td colSpan={6} className="bg-[var(--igh-surface)]">
                        <div className="py-2">
                          <div className="text-xs font-medium text-[var(--text-muted)]">Vouchers</div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {r.vouchers.map((v) => {
                              const label =
                                v.personType === "ADULT" ? `Adulto #${v.personIndex + 1}` : `Criança #${v.personIndex + 1}`;
                              return (
                                <div
                                  key={v.id}
                                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs text-[var(--text-muted)]">{label}</div>
                                    <div className="truncate text-sm font-medium text-[var(--text-primary)]">{v.name}</div>
                                    <div className="text-xs text-[var(--text-muted)]">
                                      Nº <span className="font-mono font-semibold">{v.code}</span> · Camisa {v.shirtSize} · Kit{" "}
                                      {v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—"}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {r.paymentStatus === "PAID" ? (
                                      <>
                                        <a
                                          href={`/cliente/vouchers/${encodeURIComponent(v.code)}`}
                                          className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                                        >
                                          Abrir
                                        </a>
                                        <span className="text-xs text-[var(--text-muted)]">{v.usedAt ? "Usado" : "Não usado"}</span>
                                      </>
                                    ) : (
                                      <span className="text-xs font-medium text-amber-700 dark:text-amber-200">Não quitado</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </Td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
