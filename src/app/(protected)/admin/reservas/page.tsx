"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function AdminReservasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`/api/admin/reservations${q}`);
      const json = (await res.json()) as ApiResponse<{ items: Row[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar.");
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

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

  return (
    <div className="py-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Reservas</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Solicitações de passeios; confirme ou cancele conforme o pagamento.</p>

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
                  {Number.parseFloat(r.totalPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </Td>
                <Td>
                  <Badge tone={toneForStatus(r.status)}>{statusLabel[r.status] ?? r.status}</Badge>
                </Td>
                <Td className="text-right">
                  {r.status !== "CONFIRMED" ? (
                    <Button type="button" variant="secondary" size="sm" className="mb-1 mr-1" onClick={() => void setStatus(r.id, "CONFIRMED")}>
                      Confirmar
                    </Button>
                  ) : null}
                  {r.status !== "CANCELLED" ? (
                    <Button type="button" variant="secondary" size="sm" className="mb-1 mr-1" onClick={() => void setStatus(r.id, "CANCELLED")}>
                      Cancelar
                    </Button>
                  ) : null}
                  {r.status !== "PENDING" ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => void setStatus(r.id, "PENDING")}>
                      Pendente
                    </Button>
                  ) : null}
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
