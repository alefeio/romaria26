"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Row = {
  id: string;
  name: string;
  slug: string;
  departureDate: string;
  departureTime: string;
  capacity: number;
  status: string;
  isActive: boolean;
  price: string;
};

const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  SOON: "Em breve",
  OPEN: "Aberto",
  SOLD_OUT: "Esgotado",
  CLOSED: "Encerrado",
};

export default function AdminPacotesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/packages");
      const json = (await res.json()) as ApiResponse<{ items: Row[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar pacotes.");
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

  async function removeRow(id: string) {
    if (!confirm("Excluir este pacote? Só é permitido se não houver reservas.")) return;
    const res = await fetch(`/api/admin/packages/${id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Pacote excluído.");
    void load();
  }

  return (
    <div className="py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Pacotes (passeios)</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            No site público, aparecem: Em breve, Aberto e Esgotado (desde que ativo).
          </p>
        </div>
        <Link href="/admin/pacotes/new">
          <Button>Novo pacote</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-[var(--text-secondary)]">Carregando…</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Saída</Th>
              <Th>Capacidade</Th>
              <Th>Status</Th>
              <Th>Ativo</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <Td>
                  <div className="font-medium text-[var(--text-primary)]">{p.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">/{p.slug}</div>
                </Td>
                <Td>
                  {p.departureDate?.slice(0, 10)} {p.departureTime}
                </Td>
                <Td>{p.capacity}</Td>
                <Td>
                  <Badge tone={p.status === "OPEN" ? "green" : "zinc"}>{statusLabel[p.status] ?? p.status}</Badge>
                </Td>
                <Td>{p.isActive ? "Sim" : "Não"}</Td>
                <Td className="text-right">
                  <Link href={`/admin/pacotes/${p.id}/edit`} className="mr-2 inline-block">
                    <Button variant="secondary" size="sm">
                      Editar
                    </Button>
                  </Link>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void removeRow(p.id)}>
                    Excluir
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
