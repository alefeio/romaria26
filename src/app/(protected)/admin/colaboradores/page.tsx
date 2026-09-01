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

type PackageOption = { id: string; name: string; slug: string };

type CollaboratorRow = {
  id: string;
  packageId: string;
  name: string;
  email: string;
  phone: string | null;
  roleLabel: string | null;
  shirtSize: string | null;
  code: string;
  usedAt: string | null;
  emailedAt: string | null;
  createdAt: string;
  package: { id: string; name: string; slug: string; departureDate: string };
};

const SHIRT_SIZES = ["PP", "P", "M", "G", "GG", "XG"];

export default function AdminColaboradoresPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CollaboratorRow[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [q, setQ] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const [formPackageId, setFormPackageId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formShirt, setFormShirt] = useState("M");
  const [formNotes, setFormNotes] = useState("");

  const loadPackages = useCallback(async () => {
    const res = await fetch("/api/admin/packages");
    const json = (await res.json()) as ApiResponse<{ items: PackageOption[] }>;
    if (res.ok && json.ok) {
      setPackages(json.data.items);
      if (!formPackageId && json.data.items[0]) {
        setFormPackageId(json.data.items[0].id);
      }
    }
  }, [formPackageId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (packageFilter) params.set("packageId", packageFilter);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/collaborators?${params.toString()}`);
      const json = (await res.json()) as ApiResponse<{ items: CollaboratorRow[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar colaboradores.");
        return;
      }
      setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }, [packageFilter, q, toast]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCount = useMemo(() => items.length, [items]);

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole("");
    setFormShirt("M");
    setFormNotes("");
    if (packages[0]) setFormPackageId(packages[0].id);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    if (!formPackageId) {
      toast.push("error", "Selecione o pacote/evento.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/collaborators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packageId: formPackageId,
          name: formName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim() || null,
          roleLabel: formRole.trim() || null,
          shirtSize: formShirt || null,
          notes: formNotes.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        collaborator: CollaboratorRow;
        emailWarning?: string;
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao cadastrar.");
        return;
      }
      if (json.data.emailWarning) {
        toast.push(
          "error",
          `Colaborador cadastrado (voucher ${json.data.collaborator.code}), mas o e-mail falhou: ${json.data.emailWarning}`
        );
      } else {
        toast.push(
          "success",
          `Colaborador cadastrado. Voucher ${json.data.collaborator.code} enviado por e-mail.`
        );
      }
      setCreateOpen(false);
      resetForm();
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function voidCollaborator(row: CollaboratorRow) {
    const warn = row.usedAt
      ? "Este voucher já foi utilizado no check-in. Anular mesmo assim?"
      : "Anular este colaborador? O número do voucher não será reutilizado.";
    if (!window.confirm(warn)) return;
    setActingId(row.id);
    try {
      const res = await fetch(`/api/admin/collaborators/${row.id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao anular.");
        return;
      }
      toast.push("success", "Colaborador anulado.");
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function resendEmail(row: CollaboratorRow) {
    setActingId(row.id);
    try {
      const res = await fetch(`/api/admin/collaborators/${row.id}`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ ok: true }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao reenviar e-mail.");
        return;
      }
      toast.push("success", "E-mail com voucher reenviado.");
      await load();
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Colaboradores do evento</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Equipe com vouchers na faixa <span className="font-mono font-medium">3001–4000</span>, separados dos
            ingressos de clientes. O voucher é enviado por e-mail no cadastro.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Novo colaborador
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="text-xs font-medium text-[var(--text-muted)]">Buscar</label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, e-mail, código ou função"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-muted)]">Pacote / evento</label>
          <select
            className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" className="w-full" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="mt-4 text-xs text-[var(--text-muted)]">{visibleCount} colaborador(es)</div>

      <div className="mt-4 card">
        <div className="card-body overflow-x-auto">
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Pacote</Th>
                  <Th>Função</Th>
                  <Th>Voucher</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-medium">{row.name}</Td>
                    <Td className="text-sm">{row.email}</Td>
                    <Td className="text-xs">{row.package.name}</Td>
                    <Td className="text-sm">{row.roleLabel || "—"}</Td>
                    <Td className="font-mono text-sm">{row.code}</Td>
                    <Td>
                      {row.usedAt ? (
                        <Badge tone="amber">Usado</Badge>
                      ) : row.emailedAt ? (
                        <Badge tone="green">E-mail enviado</Badge>
                      ) : (
                        <Badge tone="zinc">Pendente e-mail</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link
                          href={`/admin/vouchers/${encodeURIComponent(row.code)}`}
                          className="inline-flex min-h-[36px] items-center rounded-md border border-[var(--card-border)] px-2.5 text-xs font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)]"
                        >
                          Abrir
                        </Link>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={actingId === row.id}
                          onClick={() => void resendEmail(row)}
                        >
                          Reenviar e-mail
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={actingId === row.id}
                          onClick={() => void voidCollaborator(row)}
                        >
                          Anular
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <Td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                      Nenhum colaborador cadastrado.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      <Modal open={createOpen} title="Novo colaborador" onClose={() => setCreateOpen(false)} size="small">
        <form className="flex flex-col gap-3" onSubmit={onCreate}>
          <div>
            <label className="text-sm font-medium">Pacote / evento</label>
            <select
              required
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={formPackageId}
              onChange={(e) => setFormPackageId(e.target.value)}
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Nome completo</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">E-mail</label>
            <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Telefone (opcional)</label>
            <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Função no evento (opcional)</label>
            <Input value={formRole} onChange={(e) => setFormRole(e.target.value)} placeholder="Ex.: Segurança, Cozinha" />
          </div>
          <div>
            <label className="text-sm font-medium">Tamanho da camisa (opcional)</label>
            <select
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={formShirt}
              onChange={(e) => setFormShirt(e.target.value)}
            >
              {SHIRT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Observações (opcional)</label>
            <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Ao salvar, um voucher na faixa 3001–4000 será gerado e enviado automaticamente por e-mail.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Salvando…" : "Cadastrar e enviar voucher"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
