"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { displayCustomerEmail } from "@/lib/customer-placeholder-email";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  reservationsCount: number;
};

export default function AdminNovaReservaPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/customers");
      const json = (await res.json()) as ApiResponse<{ items: CustomerRow[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar clientes.");
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((c) => {
      const hay = `${c.name} ${c.email} ${c.phone ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [items, q]);

  return (
    <div className="py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Nova reserva</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Selecione o cliente para criar a reserva no painel.</p>
        </div>
        <Link href="/admin/reservas">
          <Button type="button" variant="secondary">
            Voltar
          </Button>
        </Link>
      </div>

      <div className="max-w-xl">
        <label className="text-sm font-medium text-[var(--text-primary)]">Buscar cliente</label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome, e-mail ou WhatsApp…"
          className="mt-1"
        />
      </div>

      {loading ? (
        <p className="mt-6 text-[var(--text-secondary)]">Carregando…</p>
      ) : (
        <div className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>WhatsApp</Th>
                <Th>Status</Th>
                <Th className="text-right">Ação</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{displayCustomerEmail(c.email)}</div>
                  </Td>
                  <Td className="text-sm text-[var(--text-secondary)]">{c.phone ?? "—"}</Td>
                  <Td className="text-xs text-[var(--text-muted)]">{c.isActive ? "Ativo" : "Inativo"}</Td>
                  <Td className="text-right">
                    <Link href={`/admin/clientes/${c.id}/nova-reserva`}>
                      <Button type="button" size="sm" disabled={!c.isActive}>
                        Criar reserva
                      </Button>
                    </Link>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <Td colSpan={4} className="py-10 text-center text-[var(--text-muted)]">
                    Nenhum cliente encontrado.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

