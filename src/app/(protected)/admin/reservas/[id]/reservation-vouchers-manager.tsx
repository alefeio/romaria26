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

const NO_SHIRT_LABEL = "Sem camisa";

function isFreeChildAge(age: number): boolean {
  return age < 6;
}

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
  hasOptionalPaidShirt: boolean;
  optionalShirtPrice: string | null;
  usedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
};

type ReservationTotals = {
  adultsCount: number;
  childrenCount: number;
  quantity: number;
  totalPrice: string;
  totalDue: string;
  totalPaid: string;
  paymentStatus: string;
};

type Props = {
  reservationId: string;
  adultsCount: number;
  childrenCount: number;
  paymentStatus: string;
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
  hasOptionalPaidShirt: boolean;
  optionalShirtPrice: string;
};

const emptyForm = (): FormState => ({
  personType: "ADULT",
  personIndex: "",
  name: "",
  shirtSize: "M",
  age: "8",
  hasBreakfastKit: false,
  hasOptionalPaidShirt: false,
  optionalShirtPrice: "",
});

export function ReservationVouchersManager({
  reservationId,
  adultsCount,
  childrenCount,
  paymentStatus: initialPaymentStatus,
  initialVouchers,
}: Props) {
  const toast = useToast();
  const router = useRouter();
  const [vouchers, setVouchers] = useState<VoucherItem[]>(initialVouchers);
  const [counts, setCounts] = useState({ adultsCount, childrenCount });
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    setCounts({ adultsCount, childrenCount });
  }, [adultsCount, childrenCount]);

  useEffect(() => {
    setPaymentStatus(initialPaymentStatus);
  }, [initialPaymentStatus]);

  useEffect(() => {
    setVouchers(initialVouchers);
  }, [initialVouchers]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/reservations/${reservationId}/vouchers`);
    const json = (await res.json()) as ApiResponse<{
      vouchers: VoucherItem[];
      reservation: ReservationTotals;
    }>;
    if (res.ok && json.ok) {
      setVouchers(json.data.vouchers);
      setCounts({
        adultsCount: json.data.reservation.adultsCount,
        childrenCount: json.data.reservation.childrenCount,
      });
      setPaymentStatus(json.data.reservation.paymentStatus);
    }
    router.refresh();
  }, [reservationId, router]);

  async function sendAllVouchersEmail() {
    if (sendingEmail || vouchers.length === 0) return;
    if (
      !window.confirm(
        "Enviar por e-mail todos os vouchers desta reserva para o cliente? Se já tiver sido enviado antes, será reenviado."
      )
    ) {
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/admin/reservations/${reservationId}/send-vouchers`, { method: "POST" });
      const raw = await res.text();
      let json: ApiResponse<{ ok: true }>;
      try {
        json = raw
          ? (JSON.parse(raw) as ApiResponse<{ ok: true }>)
          : { ok: false, error: { code: "EMPTY", message: "Resposta vazia do servidor." } };
      } catch {
        toast.push("error", `Erro do servidor ao enviar (${res.status}).`);
        return;
      }
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao enviar e-mail.");
        return;
      }
      toast.push("success", "E-mail com todos os vouchers enviado para o cliente.");
    } finally {
      setSendingEmail(false);
    }
  }

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
      hasOptionalPaidShirt: v.hasOptionalPaidShirt,
      optionalShirtPrice: v.optionalShirtPrice ?? "",
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
      const freeChild = isFreeChildAge(age);
      if (freeChild && form.hasOptionalPaidShirt) {
        const price = Number.parseFloat(form.optionalShirtPrice.replace(",", "."));
        if (!Number.isFinite(price) || price <= 0) {
          toast.push("error", "Informe o valor da camisa opcional.");
          return;
        }
        const shirtNum = Number.parseInt(form.shirtSize, 10);
        if (!Number.isInteger(shirtNum) || shirtNum <= 0) {
          toast.push("error", "Informe o tamanho da camisa para a criança gratuita.");
          return;
        }
      } else if (!freeChild) {
        const shirtNum = Number.parseInt(form.shirtSize, 10);
        if (!Number.isInteger(shirtNum) || shirtNum <= 0) {
          toast.push("error", "Informe o tamanho da camisa da criança.");
          return;
        }
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
        ...(form.personType === "CHILD"
          ? {
              age: Number.parseInt(form.age, 10),
              hasOptionalPaidShirt: form.hasOptionalPaidShirt,
              optionalShirtPrice: form.hasOptionalPaidShirt ? form.optionalShirtPrice : null,
              shirtSize:
                isFreeChildAge(Number.parseInt(form.age, 10)) && !form.hasOptionalPaidShirt
                  ? NO_SHIRT_LABEL
                  : form.shirtSize,
            }
          : {}),
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
      const json = (await res.json()) as ApiResponse<{ voucher: VoucherItem; reservation: ReservationTotals | null }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar voucher.");
        return;
      }
      const totals = json.data.reservation;
      const statusMsg = totals
        ? ` Status: ${totals.paymentStatus} · Devido: ${Number.parseFloat(totals.totalDue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "";
      toast.push(
        "success",
        editing
          ? `Voucher atualizado. Totais da reserva recalculados.${statusMsg}`
          : `Voucher criado. Valor incluído nos totais da reserva.${statusMsg}`
      );
      if (totals) setPaymentStatus(totals.paymentStatus);
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={sendingEmail || vouchers.length === 0 || paymentStatus !== "PAID"}
            title={
              paymentStatus !== "PAID"
                ? "Disponível apenas quando a reserva estiver 100% paga."
                : undefined
            }
            onClick={() => void sendAllVouchersEmail()}
          >
            {sendingEmail ? "Enviando…" : "Enviar vouchers por e-mail"}
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            Novo voucher
          </Button>
        </div>
      </div>
      <div className="card-body">
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Reserva: {counts.adultsCount} adulto(s), {counts.childrenCount} criança(s) · Pagamento:{" "}
          <span className="font-medium">{paymentStatus}</span>. Ao criar ou remover vouchers, o valor devido é
          recalculado (adulto/criança ≥ 6 anos + kit café + camisas opcionais de crianças gratuitas). Se a reserva estava quitada, um novo ingresso pago muda o
          status para PARTIAL até quitar a diferença.
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Tipo</Th>
              <Th>Nome</Th>
              <Th>Código</Th>
              <Th>Camisa</Th>
              <Th>Kit café</Th>
              <Th>Liberação</Th>
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
                  {v.hasOptionalPaidShirt && v.optionalShirtPrice ? (
                    <span className="block text-xs text-emerald-700 dark:text-emerald-300">
                      Camisa opcional:{" "}
                      {Number.parseFloat(v.optionalShirtPrice).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  ) : null}
                  {v.personType === "CHILD" && v.age != null ? (
                    <span className="text-xs text-[var(--text-muted)]"> · {v.age} anos</span>
                  ) : null}
                </Td>
                <Td>{v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—"}</Td>
                <Td className="text-xs">{v.releasedAt ? "Liberado" : "Aguardando pagamento"}</Td>
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
                <Td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">
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
            ) : isFreeChildAge(Number.parseInt(form.age, 10)) && !form.hasOptionalPaidShirt ? (
              <div className="mt-1 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
                {NO_SHIRT_LABEL}
              </div>
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
                onChange={(e) => {
                  const nextAge = e.target.value;
                  setForm((f) => ({
                    ...f,
                    age: nextAge,
                    hasOptionalPaidShirt:
                      Number.parseInt(nextAge, 10) >= 6 ? false : f.hasOptionalPaidShirt,
                    shirtSize: Number.parseInt(nextAge, 10) < 6 && !f.hasOptionalPaidShirt ? NO_SHIRT_LABEL : f.shirtSize,
                  }));
                }}
                required
              >
                {Array.from({ length: 11 }, (_, age) => (
                  <option key={age} value={age}>
                    {age === 0 ? "Menor de 1 ano" : `${age} ${age === 1 ? "ano" : "anos"}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Abaixo de 6 anos: voucher sem cobrança de ingresso.</p>
            </div>
          ) : null}
          {form.personType === "CHILD" && isFreeChildAge(Number.parseInt(form.age, 10)) ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasOptionalPaidShirt}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      hasOptionalPaidShirt: e.target.checked,
                      shirtSize: e.target.checked ? (f.shirtSize === NO_SHIRT_LABEL ? "8" : f.shirtSize) : NO_SHIRT_LABEL,
                      optionalShirtPrice: e.target.checked ? f.optionalShirtPrice : "",
                    }))
                  }
                />
                Incluir camisa (valor extra)
              </label>
              {form.hasOptionalPaidShirt ? (
                <div>
                  <label className="text-sm font-medium">Valor da camisa (R$)</label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={form.optionalShirtPrice}
                    onChange={(e) => setForm((f) => ({ ...f, optionalShirtPrice: e.target.value }))}
                    required
                  />
                </div>
              ) : null}
            </>
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
