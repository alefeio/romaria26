"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "./Button";

type Props = {
  packageId: string;
  slug: string;
  loggedIn: boolean;
  breakfastKitAvailable: boolean;
  breakfastKitPrice: string;
  unitPrice: string;
  remainingPlaces: number | null;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
};

function formatBrl(value: string): string {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PackageReservationForm({
  packageId,
  slug,
  loggedIn,
  breakfastKitAvailable,
  breakfastKitPrice,
  unitPrice,
  remainingPlaces,
  defaultName = "",
  defaultEmail = "",
  defaultPhone = "",
}: Props) {
  const [quantity, setQuantity] = useState(1);
  const [includesBreakfastKit, setIncludesBreakfastKit] = useState(false);
  const [customerNameSnapshot, setCustomerNameSnapshot] = useState(defaultName);
  const [customerEmailSnapshot, setCustomerEmailSnapshot] = useState(defaultEmail);
  const [customerPhoneSnapshot, setCustomerPhoneSnapshot] = useState(defaultPhone);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const maxQty = remainingPlaces !== null && remainingPlaces > 0 ? remainingPlaces : 1;
  const canBook = loggedIn && remainingPlaces !== null && remainingPlaces > 0;

  const estimatedTotal = useMemo(() => {
    const base = Number.parseFloat(unitPrice) || 0;
    const kit = includesBreakfastKit ? Number.parseFloat(breakfastKitPrice) || 0 : 0;
    const per = base + kit;
    return (per * quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [unitPrice, breakfastKitPrice, includesBreakfastKit, quantity]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!canBook) return;
    setLoading(true);
    try {
      const res = await fetch("/api/me/reservations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          quantity,
          includesBreakfastKit: breakfastKitAvailable && includesBreakfastKit,
          customerNameSnapshot: customerNameSnapshot.trim(),
          customerEmailSnapshot: customerEmailSnapshot.trim(),
          customerPhoneSnapshot: customerPhoneSnapshot.trim(),
          notes: notes.trim() || undefined,
          initialStatus: "PENDING",
        }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { reservation: { id: string } } }
        | { ok: false; error: { message: string } };
      if (!res.ok || !json.ok) {
        setMessage({ type: "err", text: !json.ok ? json.error.message : "Não foi possível reservar." });
        return;
      }
      setMessage({
        type: "ok",
        text: "Reserva registrada! Aguarde a confirmação. Você pode acompanhar em Minhas reservas.",
      });
      setNotes("");
    } finally {
      setLoading(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--igh-secondary)]">Reservar</h2>
        <p className="mt-2 text-sm text-[var(--igh-muted)]">
          Faça login para solicitar uma reserva neste passeio.
        </p>
        <Button as="link" href={`/login?from=/passeios/${encodeURIComponent(slug)}`} variant="primary" className="mt-4">
          Entrar para reservar
        </Button>
      </div>
    );
  }

  if (remainingPlaces === null || remainingPlaces <= 0) {
    return (
      <div className="rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--igh-secondary)]">Reservas</h2>
        <p className="mt-2 text-sm text-[var(--igh-muted)]">Não há vagas disponíveis para este passeio no momento.</p>
        <Link href="/passeios" className="mt-4 inline-block text-sm font-medium text-[var(--igh-primary)] hover:underline">
          Ver outros passeios
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--igh-secondary)]">Solicitar reserva</h2>
      <p className="mt-1 text-sm text-[var(--igh-muted)]">
        Preencha os dados. A reserva fica pendente até confirmação da equipe.
      </p>

      {message ? (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            message.type === "ok" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
        >
          {message.text}
          {message.type === "ok" ? (
            <div className="mt-2">
              <Link href="/cliente/reservas" className="font-medium underline">
                Ir para Minhas reservas
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--igh-secondary)]">Quantidade de pessoas</label>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          >
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {breakfastKitAvailable ? (
          <label className="flex items-center gap-2 text-sm text-[var(--igh-secondary)]">
            <input
              type="checkbox"
              checked={includesBreakfastKit}
              onChange={(e) => setIncludesBreakfastKit(e.target.checked)}
            />
            Incluir kit café (+ {formatBrl(breakfastKitPrice)} por pessoa)
          </label>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-[var(--igh-secondary)]">Nome completo</label>
          <input
            required
            className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={customerNameSnapshot}
            onChange={(e) => setCustomerNameSnapshot(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--igh-secondary)]">E-mail</label>
          <input
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={customerEmailSnapshot}
            onChange={(e) => setCustomerEmailSnapshot(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--igh-secondary)]">Telefone / WhatsApp</label>
          <input
            required
            className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={customerPhoneSnapshot}
            onChange={(e) => setCustomerPhoneSnapshot(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--igh-secondary)]">Observações (opcional)</label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <p className="text-sm text-[var(--igh-muted)]">
          Total estimado: <span className="font-semibold text-[var(--igh-secondary)]">{estimatedTotal}</span>
        </p>

        <button
          type="submit"
          disabled={loading || !canBook}
          className="w-full rounded-lg bg-[var(--igh-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
        >
          {loading ? "Enviando…" : "Enviar solicitação de reserva"}
        </button>
      </form>
    </div>
  );
}
