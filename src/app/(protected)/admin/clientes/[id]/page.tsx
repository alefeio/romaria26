"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import { displayCustomerEmail, isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";

type ReservationRow = {
  id: string;
  packageId: string;
  package: { id: string; name: string; slug: string; departureDate: string };
  quantity: number;
  totalPrice: string;
  totalDue: string;
  totalPaid: string;
  paymentStatus: string;
  status: string;
  reservedAt: string;
  confirmedAt: string | null;
};

type CustomerDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  isActive: boolean;
  createdAt: string;
  paymentSummary?: {
    totalDue: string;
    totalPaid: string;
    counts: { UNPAID: number; PARTIAL: number; PAID: number; CANCELED: number };
  };
  reservations: ReservationRow[];
};

export default function AdminClienteDetailPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<CustomerDetail | null>(null);
  const [installmentsDueToday, setInstallmentsDueToday] = useState<number>(0);
  const [paymentsToday, setPaymentsToday] = useState<number>(0);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCpf, setEditCpf] = useState("");

  function digitsOnly(s: string): string {
    return (s ?? "").replace(/\D/g, "");
  }

  useEffect(() => {
    if (!item) return;
    setEditName(item.name);
    setEditEmail(item.email);
    setEditPhone(item.phone ?? "");
    setEditCpf(item.cpf ?? "");
  }, [item]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`);
      const json = (await res.json()) as ApiResponse<{ item: CustomerDetail }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Cliente não encontrado.");
        setItem(null);
        return;
      }
      setItem(json.data.item);

      const dueRes = await fetch("/api/admin/payments/due-today");
      const dueJson = (await dueRes.json()) as ApiResponse<{ items: { reservationId: string }[] }>;
      if (dueRes.ok && dueJson.ok) {
        const count = dueJson.data.items.filter((i) => i.reservationId && json.data.item.reservations.some((r) => r.id === i.reservationId)).length;
        setInstallmentsDueToday(count);
      }

      const payRes = await fetch("/api/admin/payments/today");
      const payJson = (await payRes.json()) as ApiResponse<{ items: { reservationId: string }[] }>;
      if (payRes.ok && payJson.ok) {
        const count = payJson.data.items.filter((i) => i.reservationId && json.data.item.reservations.some((r) => r.id === i.reservationId)).length;
        setPaymentsToday(count);
      }
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const reservationsCount = item?.reservations.length ?? 0;

  const stage = useMemo(() => {
    if (!item) return "-";
    if (reservationsCount === 0) return "Cadastrado (sem reservas)";
    return "Com reservas";
  }, [item, reservationsCount]);

  return (
    <div className="py-6">
      <div className="mb-4">
        <Link href="/admin/clientes" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Clientes
        </Link>
      </div>

      {loading ? (
        <p className="text-[var(--text-secondary)]">Carregando…</p>
      ) : !item ? (
        <p className="text-[var(--text-secondary)]">Cliente não encontrado.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{item.name}</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{displayCustomerEmail(item.email)}</p>
              {isCustomerPlaceholderEmail(item.email) ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">E-mail ainda não informado (cadastro interno).</p>
              ) : null}
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.phone ?? "-"}</p>
              {item.cpf ? <p className="mt-1 text-sm text-[var(--text-secondary)]">CPF: {item.cpf}</p> : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge tone="zinc">{stage}</Badge>
              {paymentsToday > 0 ? <Badge tone="green">Pagamentos hoje: {paymentsToday}</Badge> : <Badge tone="zinc">Pagamentos hoje: 0</Badge>}
              {installmentsDueToday > 0 ? (
                <Badge tone="amber">Parcelas vencendo hoje: {installmentsDueToday}</Badge>
              ) : (
                <Badge tone="zinc">Parcelas vencendo hoje: 0</Badge>
              )}
              {item.paymentSummary ? (
                <div className="text-right text-xs text-[var(--text-muted)]">
                  <div>
                    Devido:{" "}
                    {Number.parseFloat(item.paymentSummary.totalDue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                  <div>
                    Pago:{" "}
                    {Number.parseFloat(item.paymentSummary.totalPaid).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                  <div className="mt-1">
                    Pendentes: {item.paymentSummary.counts.UNPAID + item.paymentSummary.counts.PARTIAL} · Pagas:{" "}
                    {item.paymentSummary.counts.PAID}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => void load()}>
                  Atualizar
                </Button>
                <Link
                  href={`/admin/clientes/${id}/nova-reserva`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Nova reserva
                </Link>
                <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
                  Editar dados
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={deleting}
                  onClick={async () => {
                    if (!id) return;
                    if (!window.confirm("Excluir este cliente definitivamente? Só é permitido se não houver reservas.")) {
                      return;
                    }
                    setDeleting(true);
                    try {
                      const res = await fetch(`/api/admin/customers/${id}`, { method: "DELETE" });
                      const json = (await res.json()) as ApiResponse<unknown>;
                      if (!res.ok || !json.ok) {
                        toast.push("error", !json.ok ? (json as { ok: false; error: { message: string } }).error.message : "Falha ao excluir.");
                        return;
                      }
                      toast.push("success", "Cliente excluído.");
                      router.push("/admin/clientes");
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  {deleting ? "Excluindo…" : "Excluir cliente"}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Reservas ({reservationsCount})</h2>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Pacote</Th>
                  <Th className="text-right">Qtd</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                  <Th>Pagamento</Th>
                  <Th className="text-right">Pagamentos</Th>
                </tr>
              </thead>
              <tbody>
                {item.reservations.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs">{new Date(r.reservedAt).toLocaleString("pt-BR")}</Td>
                    <Td>
                      <div className="font-medium">{r.package.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">Saída {r.package.departureDate}</div>
                    </Td>
                    <Td className="text-right">{r.quantity}</Td>
                    <Td className="text-right">
                      {Number.parseFloat(r.totalPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </Td>
                    <Td>{r.status}</Td>
                    <Td>
                      <Badge tone={r.paymentStatus === "PAID" ? "green" : r.paymentStatus === "PARTIAL" ? "amber" : "zinc"}>
                        {r.paymentStatus}
                      </Badge>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {Number.parseFloat(r.totalPaid).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /{" "}
                        {Number.parseFloat(r.totalDue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/reservas/${r.id}/pagamentos`}
                        className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                      >
                        Abrir
                      </Link>
                    </Td>
                  </tr>
                ))}
                {item.reservations.length === 0 ? (
                  <tr>
                    <Td colSpan={7} className="py-10 text-center text-[var(--text-muted)]">
                      Nenhuma reserva ainda.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>

          <Modal
            open={editOpen}
            onClose={() => {
              setEditOpen(false);
              if (item) {
                setEditName(item.name);
                setEditEmail(item.email);
                setEditPhone(item.phone ?? "");
                setEditCpf(item.cpf ?? "");
              }
            }}
            title="Editar cliente"
            size="small"
          >
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!id || saving) return;
                setSaving(true);
                try {
                  const res = await fetch(`/api/admin/customers/${id}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      name: editName.trim(),
                      email: editEmail.trim(),
                      phone: digitsOnly(editPhone),
                      cpf: digitsOnly(editCpf),
                    }),
                  });
                  const json = (await res.json()) as ApiResponse<unknown>;
                  if (!res.ok || !json.ok) {
                    toast.push("error", !json.ok ? (json as { ok: false; error: { message: string } }).error.message : "Falha ao salvar.");
                    return;
                  }
                  toast.push("success", "Dados atualizados.");
                  setEditOpen(false);
                  await load();
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} required className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Deixe o e-mail interno (termina em @sem-email.interno) até o cliente informar um e-mail de contato, ou substitua por um e-mail válido.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">WhatsApp (DDD + celular)</label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">CPF (opcional)</label>
                  <Input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditOpen(false);
                    if (item) {
                      setEditName(item.name);
                      setEditEmail(item.email);
                      setEditPhone(item.phone ?? "");
                      setEditCpf(item.cpf ?? "");
                    }
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}

