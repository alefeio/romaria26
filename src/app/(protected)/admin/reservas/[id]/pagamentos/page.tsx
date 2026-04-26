"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Payment = {
  id: string;
  amount: string;
  paidAt: string;
  method: string;
  note: string | null;
  receiptUrl: string | null;
};

type Installment = {
  id: string;
  dueDate: string;
  amount: string;
  status: string;
  paidAt: string | null;
  method: string | null;
  note: string | null;
  receiptUrl: string | null;
};

type Voucher = {
  id: string;
  personType: string;
  personIndex: number;
  code: string;
  name: string;
  age: number | null;
  shirtSize: string;
  hasBreakfastKit: boolean;
  usedAt: string | null;
  createdAt: string;
};

type ReservationHeader = {
  id: string;
  user: { id: string; name: string; email: string };
  package: { id: string; name: string; slug: string; departureDate: string };
  quantity: number;
  adultsCount: number;
  childrenCount: number;
  totalDue: string;
  totalPaid: string;
  paymentStatus: string;
  totalPrice: string;
};

export default function AdminReservaPagamentosPage() {
  const toast = useToast();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<ReservationHeader | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<"FREE" | "INSTALLMENT">("FREE");
  const [payInstallmentId, setPayInstallmentId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payFillPending, setPayFillPending] = useState(false);
  const [payMethod, setPayMethod] = useState<"PIX" | "CASH" | "CARD" | "TRANSFER" | "OTHER">("PIX");
  const [payReceiptUrl, setPayReceiptUrl] = useState("");
  const [payNote, setPayNote] = useState("");
  const [savingPay, setSavingPay] = useState(false);
  const [actingInstallmentId, setActingInstallmentId] = useState<string | null>(null);

  const [instOpen, setInstOpen] = useState(false);
  const [instDueDate, setInstDueDate] = useState("");
  const [instAmount, setInstAmount] = useState("");
  const [instFillPending, setInstFillPending] = useState(false);
  const [instMethod, setInstMethod] = useState<"PIX" | "CASH" | "CARD" | "TRANSFER" | "OTHER">("PIX");
  const [savingInst, setSavingInst] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/payments`);
      const json = (await res.json()) as ApiResponse<{
        reservation: ReservationHeader;
        payments: Payment[];
        installments: Installment[];
        vouchers: Voucher[];
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar pagamentos.");
        return;
      }
      setHeader(json.data.reservation);
      setPayments(json.data.payments);
      setInstallments(json.data.installments);
      setVouchers(json.data.vouchers ?? []);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const remaining = useMemo(() => {
    const due = Number.parseFloat(header?.totalDue ?? "0") || 0;
    const paid = Number.parseFloat(header?.totalPaid ?? "0") || 0;
    return Math.max(0, due - paid);
  }, [header?.totalDue, header?.totalPaid]);

  const remainingAmountText = useMemo(() => remaining.toFixed(2), [remaining]);
  const isFullyPaid = remaining <= 0;

  const scheduledInstallments = useMemo(
    () => installments.filter((i) => i.status === "SCHEDULED"),
    [installments]
  );

  function openPayModal(opts?: { mode?: "FREE" | "INSTALLMENT"; installmentId?: string }) {
    if (isFullyPaid) return;
    const mode = opts?.mode ?? "FREE";
    setPayMode(mode);
    setPayInstallmentId(opts?.installmentId ?? "");
    setPayAmount("");
    setPayFillPending(false);
    setPayReceiptUrl("");
    setPayNote("");
    setPayMethod("PIX");
    setPayOpen(true);

    if (mode === "INSTALLMENT" && opts?.installmentId) {
      const inst = installments.find((x) => x.id === opts.installmentId);
      if (inst) setPayAmount(inst.amount);
    }
  }

  function normalizeYmd(raw: string): string {
    const v = (raw ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // aceitar digitação manual pt-BR (DD/MM/AAAA)
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return v;
    const dd = m[1];
    const mm = m[2];
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  async function createPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || savingPay) return;
    if (isFullyPaid) {
      toast.push("error", "Esta reserva já está 100% paga.");
      return;
    }
    if (payMode === "INSTALLMENT") {
      if (!payInstallmentId) {
        toast.push("error", "Selecione a parcela agendada.");
        return;
      }
    }
    if (!payAmount || Number.parseFloat(payAmount) <= 0) {
      toast.push("error", "Informe um valor válido.");
      return;
    }
    setSavingPay(true);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: payAmount,
          method: payMethod,
          receiptUrl: payReceiptUrl.trim() || null,
          note: payNote.trim() || null,
          installmentId: payMode === "INSTALLMENT" && payInstallmentId ? payInstallmentId : undefined,
        }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { ok: false; error: { message: string } }).error.message : "Falha ao registrar pagamento.");
        return;
      }
      toast.push("success", "Pagamento registrado.");
      setPayOpen(false);
      setPayMode("FREE");
      setPayInstallmentId("");
      setPayAmount("");
      setPayReceiptUrl("");
      setPayNote("");
      await load();
    } finally {
      setSavingPay(false);
    }
  }

  async function patchInstallment(installmentId: string, body: Record<string, unknown>) {
    if (!id) return;
    setActingInstallmentId(installmentId);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/installments/${installmentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { ok: false; error: { message: string } }).error.message : "Falha ao atualizar parcela.");
        return;
      }
      toast.push("success", "Parcela atualizada.");
      await load();
    } finally {
      setActingInstallmentId(null);
    }
  }

  async function deleteInstallment(installmentId: string) {
    if (!id) return;
    if (!window.confirm("Excluir esta parcela?")) return;
    setActingInstallmentId(installmentId);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/installments/${installmentId}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { ok: false; error: { message: string } }).error.message : "Falha ao excluir parcela.");
        return;
      }
      toast.push("success", "Parcela excluída.");
      await load();
    } finally {
      setActingInstallmentId(null);
    }
  }

  async function createInstallment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || savingInst) return;
    if (isFullyPaid) {
      toast.push("error", "Esta reserva já está 100% paga.");
      return;
    }
    const dueDate = normalizeYmd(instDueDate);
    if (!dueDate) {
      toast.push("error", "Informe a data.");
      return;
    }
    if (!instAmount || Number.parseFloat(instAmount) <= 0) {
      toast.push("error", "Informe um valor válido.");
      return;
    }
    setSavingInst(true);
    try {
      const res = await fetch(`/api/admin/reservations/${id}/installments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dueDate,
          amount: instAmount,
          status: "SCHEDULED",
          method: instMethod,
        }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { ok: false; error: { message: string } }).error.message : "Falha ao cadastrar parcela.");
        return;
      }
      toast.push("success", "Parcela cadastrada.");
      setInstOpen(false);
      setInstDueDate("");
      setInstAmount("");
      await load();
    } finally {
      setSavingInst(false);
    }
  }

  return (
    <div className="py-6">
      <div className="mb-4">
        <Link href="/admin/reservas" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Reservas
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Pagamentos da reserva</h1>

      {loading || !header ? (
        <p className="mt-4 text-[var(--text-secondary)]">Carregando…</p>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{header.package.name}</div>
                <div className="text-xs text-[var(--text-muted)]">Saída {header.package.departureDate}</div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  Cliente: <span className="font-medium text-[var(--text-primary)]">{header.user.name}</span> ({header.user.email})
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  Adultos: {header.adultsCount} · Crianças: {header.childrenCount} · Total: {header.quantity}
                </div>
              </div>
              <div className="text-right">
                <Badge tone={header.paymentStatus === "PAID" ? "green" : header.paymentStatus === "PARTIAL" ? "amber" : "zinc"}>
                  {header.paymentStatus}
                </Badge>
                <div className="mt-2 text-sm">
                  <div>
                    Total:{" "}
                    <span className="font-semibold">
                      {Number.parseFloat(header.totalDue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div className="text-[var(--text-muted)]">
                    Pago:{" "}
                    {Number.parseFloat(header.totalPaid).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Falta:{" "}
                    {remaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    disabled={isFullyPaid}
                    onClick={() => openPayModal({ mode: "FREE" })}
                    title={isFullyPaid ? "Esta reserva já está 100% paga." : undefined}
                  >
                    Registrar pagamento
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isFullyPaid}
                    onClick={() => setInstOpen(true)}
                    title={isFullyPaid ? "Esta reserva já está 100% paga." : undefined}
                  >
                    Cadastrar parcela
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pagamentos</h2>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Método</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Comprovante</Th>
                  <Th>Obs.</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap text-xs">{new Date(p.paidAt).toLocaleString("pt-BR")}</Td>
                    <Td>{p.method}</Td>
                    <Td className="text-right">
                      {Number.parseFloat(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </Td>
                    <Td>
                      {p.receiptUrl ? (
                        <a className="text-[var(--igh-primary)] hover:underline" href={p.receiptUrl} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td className="text-xs text-[var(--text-muted)]">{p.note ?? "-"}</Td>
                  </tr>
                ))}
                {payments.length === 0 ? (
                  <tr>
                    <Td colSpan={5} className="py-10 text-center text-[var(--text-muted)]">
                      Nenhum pagamento registrado.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Parcelas agendadas</h2>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Vencimento</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Método</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {installments.map((i) => (
                  <tr key={i.id}>
                    <Td className="whitespace-nowrap text-xs">{i.dueDate}</Td>
                    <Td>{i.status}</Td>
                    <Td className="text-right">
                      {Number.parseFloat(i.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </Td>
                    <Td>{i.method ?? "-"}</Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {i.status === "SCHEDULED" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actingInstallmentId === i.id}
                              onClick={() => openPayModal({ mode: "INSTALLMENT", installmentId: i.id })}
                            >
                              Registrar pagamento
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actingInstallmentId === i.id}
                              onClick={() => {
                                if (!window.confirm("Marcar esta parcela como paga e registrar o pagamento pelo valor da parcela?")) return;
                                void patchInstallment(i.id, { status: "PAID", method: i.method ?? "PIX" });
                              }}
                            >
                              Marcar paga
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actingInstallmentId === i.id}
                              onClick={() => {
                                if (!window.confirm("Cancelar esta parcela agendada?")) return;
                                void patchInstallment(i.id, { status: "CANCELED" });
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={actingInstallmentId === i.id}
                              onClick={() => void deleteInstallment(i.id)}
                            >
                              Excluir
                            </Button>
                          </>
                        ) : null}

                        {i.status === "CANCELED" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actingInstallmentId === i.id}
                              onClick={() => {
                                if (!window.confirm("Reagendar esta parcela (voltar para agendada)?")) return;
                                void patchInstallment(i.id, { status: "SCHEDULED" });
                              }}
                            >
                              Reagendar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={actingInstallmentId === i.id}
                              onClick={() => void deleteInstallment(i.id)}
                            >
                              Excluir
                            </Button>
                          </>
                        ) : null}

                        {i.status === "PAID" ? (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
                {installments.length === 0 ? (
                  <tr>
                    <Td colSpan={5} className="py-10 text-center text-[var(--text-muted)]">
                      Nenhuma parcela cadastrada.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Vouchers</h2>
              <div className="text-xs text-[var(--text-muted)]">
                {vouchers.length}/{header.quantity} gerado(s)
              </div>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Nome</Th>
                  <Th>Tipo</Th>
                  <Th>Camisa</Th>
                  <Th>Kit café</Th>
                  <Th className="text-right">Ação</Th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <Td className="font-mono text-xs">{v.code}</Td>
                    <Td>
                      <div className="font-medium">{v.name}</div>
                      {v.age !== null ? (
                        <div className="text-xs text-[var(--text-muted)]">Idade: {v.age}</div>
                      ) : null}
                    </Td>
                    <Td className="text-xs text-[var(--text-muted)]">
                      {v.personType === "ADULT" ? `Adulto #${v.personIndex + 1}` : `Criança #${v.personIndex + 1}`}
                    </Td>
                    <Td className="text-sm">{v.shirtSize}</Td>
                    <Td className="text-sm">{v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—"}</Td>
                    <Td className="text-right">
                      <a
                        className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                        href={`/voucher/${encodeURIComponent(v.code)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir
                      </a>
                    </Td>
                  </tr>
                ))}
                {vouchers.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="py-10 text-center text-[var(--text-muted)]">
                      Nenhum voucher gerado ainda.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
            {header.paymentStatus !== "PAID" ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Os vouchers são enviados por e-mail após a reserva ficar 100% paga.
              </p>
            ) : null}
          </div>

          <Modal
            open={payOpen}
            title="Registrar pagamento"
            onClose={() => {
              setPayOpen(false);
              setPayMode("FREE");
              setPayInstallmentId("");
            }}
            size="small"
          >
            <form className="flex flex-col gap-3" onSubmit={createPayment}>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <select
                  className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={payMode}
                  onChange={(e) => {
                    const mode = e.target.value as typeof payMode;
                    setPayMode(mode);
                    if (mode === "FREE") {
                      setPayInstallmentId("");
                    }
                  }}
                >
                  <option value="FREE">Pagamento avulso</option>
                  <option value="INSTALLMENT">Liquidar parcela agendada</option>
                </select>
                {payMode === "INSTALLMENT" && scheduledInstallments.length === 0 ? (
                  <div className="mt-2 text-xs text-[var(--text-muted)]">Não há parcelas agendadas para vincular.</div>
                ) : null}
              </div>

              {payMode === "INSTALLMENT" ? (
                <div>
                  <label className="text-sm font-medium">Parcela</label>
                  <select
                    className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
                    value={payInstallmentId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setPayInstallmentId(nextId);
                      const inst = installments.find((x) => x.id === nextId);
                      if (inst) setPayAmount(inst.amount);
                    }}
                  >
                    <option value="">Selecione…</option>
                    {scheduledInstallments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.dueDate} ·{" "}
                        {Number.parseFloat(s.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium">Valor (R$)</label>
                <Input
                  value={payAmount}
                  onChange={(e) => {
                    setPayAmount(e.target.value);
                    if (payFillPending) setPayFillPending(false);
                  }}
                  placeholder="Ex.: 150"
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={payFillPending}
                    disabled={remaining <= 0}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setPayFillPending(checked);
                      if (checked) setPayAmount(remainingAmountText);
                    }}
                  />
                  Preencher valor pendente automaticamente
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">Método</label>
                <select
                  className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                >
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CARD">Cartão</option>
                  <option value="TRANSFER">Transferência</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Comprovante (URL opcional)</label>
                <Input value={payReceiptUrl} onChange={(e) => setPayReceiptUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm font-medium">Observação (opcional)</label>
                <textarea
                  rows={3}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setPayOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingPay}>
                  {savingPay ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal open={instOpen} title="Cadastrar parcela" onClose={() => setInstOpen(false)} size="small">
            <form className="flex flex-col gap-3" onSubmit={createInstallment}>
              <div>
                <label className="text-sm font-medium">Data (AAAA-MM-DD)</label>
                <Input type="date" value={instDueDate} onChange={(e) => setInstDueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Valor (R$)</label>
                <Input
                  value={instAmount}
                  onChange={(e) => {
                    setInstAmount(e.target.value);
                    if (instFillPending) setInstFillPending(false);
                  }}
                  placeholder="Ex.: 50"
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={instFillPending}
                    disabled={remaining <= 0}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setInstFillPending(checked);
                      if (checked) setInstAmount(remainingAmountText);
                    }}
                  />
                  Preencher valor pendente automaticamente
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">Método (previsto)</label>
                <select
                  className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={instMethod}
                  onChange={(e) => setInstMethod(e.target.value as typeof instMethod)}
                >
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CARD">Cartão</option>
                  <option value="TRANSFER">Transferência</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setInstOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingInst}>
                  {savingInst ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}

