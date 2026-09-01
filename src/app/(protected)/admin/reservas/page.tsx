"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Row = {
  id: string;
  customerNameSnapshot: string;
  customerEmailSnapshot: string;
  customerPhoneSnapshot: string;
  quantity: number;
  includesBreakfastKit: boolean;
  totalPrice: string;
  discountAmount: string;
  totalDue: string;
  status: string;
  notes: string | null;
  reservedAt: string;
  confirmedAt: string | null;
  user: { name: string; email: string };
  package: { name: string; slug: string; departureDate: string };
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
};

const toneForStatus = (s: string): "amber" | "green" | "red" | "zinc" => {
  if (s === "CONFIRMED") return "green";
  if (s === "CANCELLED") return "red";
  if (s === "PENDING") return "amber";
  return "zinc";
};

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminReservasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter) qs.set("status", filter);
      if (q.trim()) qs.set("q", q.trim());
      const query = qs.toString();
      const res = await fetch(`/api/admin/reservations${query ? `?${query}` : ""}`);
      const json = (await res.json()) as ApiResponse<{ items: Row[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar.");
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }, [filter, q, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: "PENDING" | "CONFIRMED" | "CANCELLED") {
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = (await res.json()) as ApiResponse<unknown>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as { ok: false; error: { message: string } }).error.message : "Falha.");
      return;
    }
    toast.push("success", "Status atualizado.");
    void load();
  }

  async function deleteReservation(id: string) {
    if (!window.confirm("Excluir esta reserva? Esta ação remove pagamentos/parcelas/vouchers vinculados.")) return;
    const res = await fetch(`/api/admin/reservations/${id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<unknown>;
    if (!res.ok || !json.ok) {
      toast.push(
        "error",
        !json.ok ? (json as { ok: false; error: { message: string } }).error.message : "Falha ao excluir."
      );
      return;
    }
    toast.push("success", "Reserva excluída.");
    setOpenMenuId(null);
    void load();
  }

  function openMenuFor(id: string, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    setOpenMenuId(id);
    setMenuPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
  }

  function closeMenu() {
    setOpenMenuId(null);
    setMenuPos(null);
  }

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Reservas</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Solicitações de passeios; confirme ou cancele conforme o pagamento.
          </p>
        </div>
        <Link href="/admin/reservas/nova">
          <Button type="button" variant="primary">
            Nova reserva
          </Button>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant={filter === "" ? "primary" : "secondary"} size="sm" onClick={() => setFilter("")}>
          Todas
        </Button>
        <Button
          type="button"
          variant={filter === "PENDING" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilter("PENDING")}
        >
          Pendentes
        </Button>
        <Button
          type="button"
          variant={filter === "CONFIRMED" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilter("CONFIRMED")}
        >
          Confirmadas
        </Button>
        <Button
          type="button"
          variant={filter === "CANCELLED" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilter("CANCELLED")}
        >
          Canceladas
        </Button>
      </div>

      <div className="mt-3 max-w-md">
        <label className="text-sm font-medium text-[var(--text-primary)]">Filtrar por nome</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Digite o nome do cliente…"
          className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <div className="mt-1 text-xs text-[var(--text-muted)]">Dica: também aceita e-mail e WhatsApp.</div>
      </div>

      {loading ? (
        <p className="mt-6 text-[var(--text-secondary)]">Carregando…</p>
      ) : (
        <div className="mt-6">
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Pacote</Th>
              <Th>Cliente</Th>
              <Th>Conta</Th>
              <Th>Qtd</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-xs">
                  {new Date(r.reservedAt).toLocaleString("pt-BR")}
                </Td>
                <Td>
                  <div className="font-medium">{r.package.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Saída {r.package.departureDate}
                  </div>
                </Td>
                <Td>
                  <div>{r.customerNameSnapshot}</div>
                  <div className="text-xs text-[var(--text-muted)]">{r.customerEmailSnapshot}</div>
                  <div className="text-xs text-[var(--text-muted)]">{r.customerPhoneSnapshot}</div>
                </Td>
                <Td className="text-xs text-[var(--text-muted)]">{r.user.email}</Td>
                <Td>
                  {r.quantity}
                  {r.includesBreakfastKit ? <span className="block text-xs text-[var(--text-muted)]">+ kit</span> : null}
                </Td>
                <Td>
                  {(() => {
                    const subtotal = Number.parseFloat(r.totalPrice) || 0;
                    const discount = Number.parseFloat(r.discountAmount) || 0;
                    const finalValue = Number.parseFloat(r.totalDue) || 0;
                    return (
                      <div className="text-sm">
                        <div className="font-medium text-[var(--text-primary)]">{brl(finalValue)}</div>
                        {discount > 0 ? (
                          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {brl(subtotal)} − {brl(discount)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </Td>
                <Td>
                  <Badge tone={toneForStatus(r.status)}>{statusLabel[r.status] ?? r.status}</Badge>
                </Td>
                <Td className="text-right">
                  <div className="inline-block text-left">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mb-1"
                      onClick={(e) => {
                        const el = e.currentTarget as unknown as HTMLElement;
                        setOpenMenuId((curr) => {
                          if (curr === r.id) {
                            closeMenu();
                            return null;
                          }
                          openMenuFor(r.id, el);
                          return r.id;
                        });
                      }}
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === r.id}
                      title="Mais opções"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {openMenuId === r.id ? (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => closeMenu()} aria-hidden="true" />
                        <div
                          className="fixed z-50 w-52 overflow-hidden rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg"
                          role="menu"
                          style={menuPos ? { top: menuPos.top, right: menuPos.right } : undefined}
                        >
                          <Link
                            href={`/admin/reservas/${r.id}`}
                            className="block px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                            onClick={() => closeMenu()}
                          >
                            Detalhes
                          </Link>
                          <Link
                            href={`/admin/reservas/${r.id}/pagamentos`}
                            className="block px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                            onClick={() => closeMenu()}
                          >
                            Pagamentos
                          </Link>
                          {r.status !== "CONFIRMED" ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                              onClick={() => void setStatus(r.id, "CONFIRMED")}
                            >
                              Confirmar
                            </button>
                          ) : null}
                          {r.status !== "CANCELLED" ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                              onClick={() => void setStatus(r.id, "CANCELLED")}
                            >
                              Cancelar
                            </button>
                          ) : null}
                          {r.status !== "PENDING" ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                              onClick={() => void setStatus(r.id, "PENDING")}
                            >
                              Marcar como pendente
                            </button>
                          ) : null}
                          <div className="h-px bg-[var(--card-border)]" />
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-[var(--igh-surface)]"
                            onClick={() => void deleteReservation(r.id)}
                          >
                            Excluir reserva
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        </div>
      )}
    </div>
  );
}
