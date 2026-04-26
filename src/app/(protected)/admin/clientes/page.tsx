"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { displayCustomerEmail } from "@/lib/customer-placeholder-email";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  isActive: boolean;
  createdAt: string;
  reservationsCount: number;
  paymentStatusCounts?: { UNPAID: number; PARTIAL: number; PAID: number; CANCELED: number };
  stage: "REGISTERED_ONLY" | "HAS_RESERVATIONS" | "HAS_RESERVATIONS_WITH_DUE" | "HAS_RESERVATIONS_PAID";
};

function toneForStage(stage: CustomerRow["stage"]): "zinc" | "amber" | "green" {
  if (stage === "REGISTERED_ONLY") return "zinc";
  if (stage === "HAS_RESERVATIONS_WITH_DUE") return "amber";
  return "green";
}

function labelForStage(stage: CustomerRow["stage"]): string {
  if (stage === "REGISTERED_ONLY") return "Cadastrado";
  if (stage === "HAS_RESERVATIONS_WITH_DUE") return "Com pendências";
  if (stage === "HAS_RESERVATIONS_PAID") return "Pago";
  return "Com reservas";
}

export default function AdminClientesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function digitsOnly(s: string): string {
    return (s ?? "").replace(/\D/g, "");
  }

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

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const d = q.replace(/\D/g, "");
    if (!s && !d) return items;
    return items.filter((c) => {
      if ((c.name ?? "").toLowerCase().includes(s)) return true;
      if ((c.email ?? "").toLowerCase().includes(s)) return true;
      if (d.length >= 3) {
        if ((c.phone ?? "").includes(d)) return true;
        if ((c.cpf ?? "").includes(d)) return true;
      }
      return false;
    });
  }, [items, q]);

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Clientes</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Cadastro e acompanhamento de etapa (cadastro, reservas, pagamentos).</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => {
              setTempPassword(null);
              setNewName("");
              setNewEmail("");
              setNewPhone("");
              setNewCpf("");
              setCreateOpen(true);
            }}
          >
            Novo cliente
          </Button>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="mt-4 max-w-md">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail, telefone ou CPF" />
      </div>

      {loading ? (
        <p className="mt-6 text-[var(--text-secondary)]">Carregando…</p>
      ) : (
        <div className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Contato</Th>
                <Th>Etapa</Th>
                <Th className="text-right">Reservas</Th>
                <Th className="text-right">Pendências</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{displayCustomerEmail(c.email)}</div>
                  </Td>
                  <Td>
                    <div className="text-xs text-[var(--text-muted)]">{c.phone ?? "-"}</div>
                    <div className="text-xs text-[var(--text-muted)]">{c.cpf ? `CPF: ${c.cpf}` : ""}</div>
                  </Td>
                  <Td>
                    <Badge tone={toneForStage(c.stage)}>{labelForStage(c.stage)}</Badge>
                  </Td>
                  <Td className="text-right">{c.reservationsCount}</Td>
                  <Td className="text-right text-xs text-[var(--text-muted)]">
                    {(c.paymentStatusCounts?.UNPAID ?? 0) + (c.paymentStatusCounts?.PARTIAL ?? 0)}
                  </Td>
                  <Td className="text-right">
                    <Link href={`/admin/clientes/${c.id}`} className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
                      Ver ficha
                    </Link>
                  </Td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-10 text-center text-[var(--text-muted)]">
                    Nenhum cliente encontrado.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Cadastrar cliente">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (creating) return;
            setCreating(true);
            try {
              const res = await fetch("/api/admin/customers", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  name: newName,
                  email: newEmail.trim(),
                  phone: digitsOnly(newPhone),
                  cpf: digitsOnly(newCpf),
                }),
              });
              const json = (await res.json()) as ApiResponse<{ item: { id: string }; temporaryPassword: string }>;
              if (!res.ok || !json.ok) {
                toast.push("error", !json.ok ? json.error.message : "Falha ao cadastrar cliente.");
                return;
              }
              toast.push("success", "Cliente cadastrado.");
              setTempPassword(json.data.temporaryPassword ?? null);
              await load();
            } finally {
              setCreating(false);
            }
          }}
        >
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">E-mail (opcional)</label>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              type="text"
              inputMode="email"
              autoComplete="off"
              placeholder="deixe em branco se o cliente ainda não tiver e-mail"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Se vazio, será criado um e-mail interno (login poderá ser pelo e-mail quando o cliente informar depois).</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">WhatsApp (DDD + celular)</label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(91) 99999-9999" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">CPF (opcional)</label>
              <Input value={newCpf} onChange={(e) => setNewCpf(e.target.value)} placeholder="Somente números" className="mt-1" />
            </div>
          </div>

          {tempPassword ? (
            <div className="rounded-lg border border-[var(--igh-border)] bg-[var(--background)] p-3 text-sm">
              <div className="text-xs font-medium text-[var(--text-muted)]">Senha temporária (anote e envie ao cliente)</div>
              <div className="mt-1 font-mono text-[var(--text-primary)]">{tempPassword}</div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Fechar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Salvando…" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

