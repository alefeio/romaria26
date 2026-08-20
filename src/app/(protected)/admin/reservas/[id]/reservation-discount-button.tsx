"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";

type DiscountResult = {
  reservation: {
    id: string;
    totalPrice: string;
    discountAmount: string;
    discountNote: string | null;
    totalDue: string;
    totalPaid: string;
    paymentStatus: string;
  };
};

type Props = {
  reservationId: string;
  totalPrice: string;
  discountAmount: string;
  discountNote: string | null;
  /** Se informado, chamado após sucesso (ex.: recarregar lista de pagamentos). */
  onApplied?: () => void | Promise<void>;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
};

export function ReservationDiscountButton({
  reservationId,
  totalPrice,
  discountAmount: initialDiscountAmount,
  discountNote: initialDiscountNote,
  onApplied,
  size = "md",
  variant = "secondary",
}: Props) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotalValue = useMemo(
    () => Number.parseFloat(totalPrice) || 0,
    [totalPrice]
  );

  const previewDueAfterDiscount = useMemo(() => {
    const discount = Number.parseFloat(amount.replace(",", ".")) || 0;
    return Math.max(0, subtotalValue - discount);
  }, [amount, subtotalValue]);

  function openModal() {
    setAmount(initialDiscountAmount && initialDiscountAmount !== "0" ? initialDiscountAmount : "");
    setNote(initialDiscountNote ?? "");
    setOpen(true);
  }

  async function applyDiscount(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const raw = amount.replace(",", ".").trim();
    if (raw === "" || Number.parseFloat(raw) < 0) {
      toast.push("error", "Informe um valor de desconto válido (use 0 para remover).");
      return;
    }
    if (Number.parseFloat(raw) > subtotalValue) {
      toast.push("error", "O desconto não pode ser maior que o subtotal da reserva.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/reservations/${reservationId}/discount`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: raw,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<DiscountResult>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao aplicar desconto.");
        return;
      }
      toast.push("success", "Desconto aplicado. Totais da reserva atualizados.");
      setOpen(false);
      if (onApplied) {
        await onApplied();
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={openModal}>
        Conceder desconto
      </Button>

      <Modal open={open} title="Conceder desconto" onClose={() => setOpen(false)} size="small">
        <form className="flex flex-col gap-3" onSubmit={applyDiscount}>
          <p className="text-sm text-[var(--text-secondary)]">
            Subtotal atual:{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {subtotalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </p>
          <div>
            <label className="text-sm font-medium">Valor do desconto (R$)</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex.: 50.00" />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Use 0 para remover o desconto.</p>
          </div>
          <div>
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Ex.: cortesia, acordo comercial…"
            />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Total devido após desconto:{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {previewDueAfterDiscount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Aplicar desconto"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
