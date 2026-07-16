"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

export type VoucherItem = {
  id: string;
  personType: "ADULT" | "CHILD";
  personIndex: number;
  code: string;
  codeNumber: number | null;
  name: string;
  age: number | null;
  shirtSize: string;
  hasBreakfastKit: boolean;
  usedAt: string | null;
  createdAt: string;
};

type Props = {
  reservationId: string;
  adultsCount: number;
  childrenCount: number;
  initialVouchers: VoucherItem[];
};

const SHIRT_SIZES = ["PP", "P", "M", "G", "GG", "XG"];

type FormState = {
  personType: "ADULT" | "CHILD";
  personIndex: string;
  name: string;
  shirtSize: string;
  age: string;
  hasBreakfastKit: boolean;
};

const emptyForm = (): FormState => ({
  personType: "ADULT",
  personIndex: "",
  name: "",
  shirtSize: "M",
  age: "8",
  hasBreakfastKit: false,
});

export function ReservationVouchersManager({ reservationId, adultsCount, childrenCount, initialVouchers }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [vouchers, setVouchers] = useState<VoucherItem[]>(initialVouchers);
  const [counts, setCounts] = useState({ adultsCount, childrenCount });
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    setCounts({ adultsCount, childrenCount });
  }, [adultsCount, childrenCount]);

  useEffect(() => {
    setVouchers(initialVouchers);
  }, [initialVouchers]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/reservations/${reservationId}/vouchers`);
    const json = (await res.json()) as ApiResponse<{
      vouchers: VoucherItem[];
      reservation: { adultsCount: number; childrenCount: number };
    }>;
    if (res.ok && json.ok) {
      setVouchers(json.data.vouchers);
      setCounts({
        adultsCount: json.data.reservation.adultsCount,
        childrenCount: json.data.reservation.childrenCount,
      });
    }
    router.refresh();
  }, [reservationId, router]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(v: VoucherItem) {
    setEditing(v);
    setForm({
      personType: v.personType,
      personIndex: String(v.personIndex),
      name: v.name,
      shirtSize: v.shirtSize,
      age: v.age != null ? String(v.age) : "8",
      hasBreakfastKit: v.hasBreakfastKit,
    });
    setModalOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    if (!name) {
      toast.push("error", "Informe o nome.");
      return;
    }
    if (form.personType === "CHILD") {
      const age = Number.parseInt(form.age, 10);
      if (!Number.isInteger(age) || age < 0 || age > 10) {
        toast.push("error", "Idade da criança: 0 a 10 anos.");
        return;
      }
    }

    setSaving(true);
    try {
      const personIndex =
        form.personIndex.trim() !== "" ? Number.parseInt(form.personIndex, 10) : undefined;
      if (personIndex !== undefined && (!Number.isInteger(personIndex) || personIndex < 0)) {
        toast.push("error", "Índice inválido.");
        return;
      }

      const payload = {
        personType: form.personType,
        ...(personIndex !== undefined ? { personIndex } : {}),
        name,
        shirtSize: form.shirtSize,
        ...(form.personType === "CHILD" ? { age: Number.parseInt(form.age, 10) } : {}),
        ...(form.personType === "ADULT" ? { hasBreakfastKit: form.hasBreakfastKit } : {}),
      };

      const url = editing
        ? `/api/admin/reservations/${reservationId}/vouchers/${editing.id}`
        : `/api/admin/reservations/${reservationId}/vouchers`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<{ voucher: VoucherItem }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar voucher.");
        return;
      }
      toast.push(
        "success",
        editing
          ? "Voucher atualizado. Totais da reserva recalculados."
          : "Voucher criado. Valor incluído nos totais da reserva."
      );
      setModalOpen(false);
      setEditing(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function deleteVoucher(v: VoucherItem) {
    const warn = v.usedAt
      ? "Este voucher já foi utilizado (check-in). Excluir mesmo assim?"
      : "Excluir este voucher? O valor será removido dos totais da reserva.";
    if (!window.confirm(warn)) return;
    setActingId(v.id);
    try {
      const res = await fetch(`/api/admin/reservations/${reservationId}/vouchers/${v.id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao excluir voucher.");
        return;
      }
      toast.push("success", "Voucher excluído. Totais da reserva recalculados.");
      await reload();
    } finally {
      setActingId(null);
    }
  }

  function personLabel(v: VoucherItem): string {
    return v.personType === "ADULT" ? `Adulto #${v.personIndex + 1}` : `Criança #${v.personIndex + 1}`;
  }

  return (
    <div className="mt-6 card">
      <div className="card-header flex flex-wrap items-center justify-between gap-2">
        <span>Ingressos / Vouchers</span>
        <Button type="button" size="sm" onClick={openCreate}>
          Novo voucher
        </Button>
      </div>
      <div className="card-body">
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Reserva: {counts.adultsCount} adulto(s), {counts.childrenCount} criança(s). Ao criar ou remover vouchers, o
          valor devido é recalculado (adulto/criança ≥ 6 anos + kit café), com os preços da reserva. Códigos por faixa
          (kit, sem kit, criança).
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Tipo</Th>
              <Th>Nome</Th>
              <Th>Código</Th>
              <Th>Camisa</Th>
              <Th>Kit café</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id}>
                <Td className="text-xs">{personLabel(v)}</Td>
                <Td className="font-medium">{v.name}</Td>
                <Td className="font-mono text-sm">{v.code}</Td>
                <Td>
                  {v.shirtSize}
                  {v.personType === "CHILD" && v.age != null ? (
                    <span className="text-xs text-[var(--text-muted)]"> · {v.age} anos</span>
                  ) : null}
                </Td>
                <Td>{v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—"}</Td>
                <Td className="text-xs">{v.usedAt ? "Usado" : "Não usado"}</Td>
                <Td className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link
                      href={`/admin/vouchers/${encodeURIComponent(v.code)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[36px] items-center rounded-md border border-[var(--card-border)] px-2.5 text-xs font-medium text-[var(--igh-primary)] hover:bg-[var(--igh-surface)]"
                    >
                      Abrir
                    </Link>
                    <Button type="button" size="sm" variant="secondary" disabled={actingId === v.id} onClick={() => openEdit(v)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={actingId === v.id}
                      onClick={() => void deleteVoucher(v)}
                    >
                      Excluir
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {vouchers.length === 0 ? (
              <tr>
                <Td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                  Nenhum voucher. Clique em &quot;Novo voucher&quot; ou quite o pagamento para gerar automaticamente.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? "Editar voucher" : "Novo voucher"}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        size="small"
      >
        <form className="flex flex-col gap-3" onSubmit={submitForm}>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={form.personType}
              disabled={Boolean(editing?.usedAt)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  personType: e.target.value as "ADULT" | "CHILD",
                }))
              }
            >
              <option value="ADULT">Adulto</option>
              <option value="CHILD">Criança</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Índice (opcional)</label>
            <Input
              type="number"
              min={0}
              value={form.personIndex}
              onChange={(e) => setForm((f) => ({ ...f, personIndex: e.target.value }))}
              placeholder="Automático se vazio"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Ex.: 0 = primeiro adulto/criança. Deixe vazio para o próximo livre.</p>
          </div>
          <div>
            <label className="text-sm font-medium">Nome completo</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="text-sm font-medium">Tamanho da camisa</label>
            {form.personType === "ADULT" ? (
              <select
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.shirtSize}
                onChange={(e) => setForm((f) => ({ ...f, shirtSize: e.target.value }))}
              >
                {SHIRT_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="number"
                min={1}
                max={120}
                value={form.shirtSize}
                onChange={(e) => setForm((f) => ({ ...f, shirtSize: e.target.value }))}
                placeholder="Ex.: 8, 10, 12"
              />
            )}
          </div>
          {form.personType === "CHILD" ? (
            <div>
              <label className="text-sm font-medium">Idade</label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.age}
                onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                required
              >
                {Array.from({ length: 11 }, (_, age) => (
                  <option key={age} value={age}>
                    {age === 0 ? "Menor de 1 ano" : `${age} ${age === 1 ? "ano" : "anos"}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Abaixo de 6 anos: voucher sem cobrança.</p>
            </div>
          ) : null}
          {form.personType === "ADULT" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hasBreakfastKit}
                onChange={(e) => setForm((f) => ({ ...f, hasBreakfastKit: e.target.checked }))}
              />
              Kit café da manhã
            </label>
          ) : null}
          {editing ? (
            <p className="text-xs text-[var(--text-muted)]">
              Código atual: <span className="font-mono font-semibold">{editing.code}</span>
              {editing.usedAt ? " · Voucher já utilizado no check-in." : null}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
