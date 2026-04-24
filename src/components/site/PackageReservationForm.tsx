"use client";

import { useEffect, useMemo, useState } from "react";
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
  kitsDeliveryInfo?: string | null;
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
  kitsDeliveryInfo = null,
  defaultName = "",
  defaultEmail = "",
  defaultPhone = "",
}: Props) {
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [customerNameSnapshot, setCustomerNameSnapshot] = useState(defaultName);
  const [customerEmailSnapshot, setCustomerEmailSnapshot] = useState(defaultEmail);
  const [customerPhoneSnapshot, setCustomerPhoneSnapshot] = useState(defaultPhone);
  function digitsOnly(s: string): string {
    return (s ?? "").replace(/\D/g, "").slice(0, 11);
  }

  function formatBrPhone(value: string): string {
    const d = digitsOnly(value);
    if (d.length <= 2) return d;
    const dd = d.slice(0, 2);
    if (d.length <= 7) return `(${dd}) ${d.slice(2)}`;
    const part1 = d.slice(2, 7);
    const part2 = d.slice(7);
    return `(${dd}) ${part1}${part2 ? "-" + part2 : ""}`;
  }
  const [notes, setNotes] = useState("");
  const [adultShirtSizes, setAdultShirtSizes] = useState<string[]>(["M"]);
  const [childrenShirtNumbers, setChildrenShirtNumbers] = useState<number[]>([]);
  const [breakfastSelections, setBreakfastSelections] = useState<boolean[]>([false]);
  const [breakfastKitSelections, setBreakfastKitSelections] = useState<boolean[]>([false]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const maxQty = remainingPlaces !== null && remainingPlaces > 0 ? remainingPlaces : 1;
  const canBook = loggedIn && remainingPlaces !== null && remainingPlaces > 0;
  const quantity = Math.max(0, adultsCount) + Math.max(0, childrenCount);

  const shirtCount = Math.min(maxQty, Math.max(1, quantity));
  useEffect(() => {
    setAdultShirtSizes((prev) => {
      const next = prev.slice(0, adultsCount);
      while (next.length < adultsCount) next.push(prev[prev.length - 1] ?? "M");
      return next;
    });
    setChildrenShirtNumbers((prev) => {
      const next = prev.slice(0, childrenCount);
      while (next.length < childrenCount) next.push(6);
      return next;
    });
    setBreakfastSelections((prev) => {
      const next = prev.slice(0, shirtCount);
      while (next.length < shirtCount) next.push(false);
      return next;
    });
    setBreakfastKitSelections((prev) => {
      const next = prev.slice(0, adultsCount);
      while (next.length < adultsCount) next.push(false);
      return next;
    });
  }, [adultsCount, childrenCount, shirtCount]);

  function clampCounts(nextAdults: number, nextChildren: number) {
    const a = Number.isFinite(nextAdults) ? Math.max(0, Math.trunc(nextAdults)) : 0;
    const c = Number.isFinite(nextChildren) ? Math.max(0, Math.trunc(nextChildren)) : 0;
    // total não pode ficar zero (todos os itens exceto observações são obrigatórios)
    if (a + c === 0) return { a: 1, c: 0 };
    if (a + c <= maxQty) return { a, c };
    // reduzir crianças primeiro (mais comum ajustar)
    const c2 = Math.max(0, maxQty - a);
    if (a + c2 <= maxQty) return { a, c: c2 };
    // se ainda excedeu, reduzir adultos
    return { a: maxQty, c: 0 };
  }

  const estimatedTotal = useMemo(() => {
    const base = Number.parseFloat(unitPrice) || 0;
    const kitUnit = Number.parseFloat(breakfastKitPrice) || 0;
    const kitCount = breakfastKitSelections.filter(Boolean).length;
    const total = base * shirtCount + kitUnit * kitCount;
    return total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [unitPrice, breakfastKitPrice, breakfastKitSelections, shirtCount]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!canBook) return;
    if (adultsCount + childrenCount < 1) {
      setMessage({ type: "err", text: "Informe pelo menos 1 pessoa (adulto ou criança)." });
      return;
    }
    if (childrenCount > 0) {
      const invalidChild = childrenShirtNumbers.some((n) => !Number.isInteger(n) || n <= 0);
      if (invalidChild) {
        setMessage({ type: "err", text: "Informe a idade/número da camisa para cada criança (ex.: 6, 8, 10, 12)." });
        return;
      }
    }
    if (digitsOnly(customerPhoneSnapshot).length !== 11) {
      setMessage({ type: "err", text: "Informe um celular com DDD (11 dígitos) no WhatsApp." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/me/reservations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          adultsCount,
          childrenCount,
          quantity: shirtCount,
          adultShirtSizes,
          childrenShirtNumbers,
          breakfastSelections,
          breakfastKitSelections: breakfastKitAvailable ? breakfastKitSelections : adultShirtSizes.map(() => false),
          customerNameSnapshot: customerNameSnapshot.trim(),
          customerEmailSnapshot: customerEmailSnapshot.trim(),
          customerPhoneSnapshot: customerPhoneSnapshot.trim(),
          notes: notes.trim() || undefined,
          initialStatus: "PENDING",
        }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { reservation: { id: string }; whatsappUrl?: string } }
        | { ok: false; error: { message: string } };
      if (!res.ok || !json.ok) {
        setMessage({ type: "err", text: !json.ok ? json.error.message : "Não foi possível reservar." });
        return;
      }
      setMessage({
        type: "ok",
        text: "Reserva registrada! Enviamos os dados e vamos te atender no WhatsApp.",
      });
      setNotes("");
      if (json.ok && json.data?.whatsappUrl) {
        window.location.href = json.data.whatsappUrl;
      }
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
        <Button
          as="link"
          href={`/cadastro?from=/passeios/${encodeURIComponent(slug)}`}
          variant="outline"
          className="mt-2"
        >
          Criar conta
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
          <div className="mt-1 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-[var(--igh-muted)]">Adultos</div>
              <input
                type="number"
                min={0}
                max={maxQty}
                required
                className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={adultsCount}
                onChange={(e) => {
                  const next = clampCounts(Number(e.target.value), childrenCount);
                  setAdultsCount(next.a);
                  setChildrenCount(next.c);
                }}
              />
            </div>
            <div>
              <div className="text-xs text-[var(--igh-muted)]">Crianças</div>
              <input
                type="number"
                min={0}
                max={maxQty}
                required
                className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={childrenCount}
                onChange={(e) => {
                  const next = clampCounts(adultsCount, Number(e.target.value));
                  setAdultsCount(next.a);
                  setChildrenCount(next.c);
                }}
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--igh-muted)]">
            Total: <span className="font-medium text-[var(--igh-secondary)]">{shirtCount}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--igh-secondary)]">Ingressos</label>
          <div className="mt-2 space-y-3">
            {adultsCount > 0 ? (
              <div className="rounded-lg border border-[var(--igh-border)] bg-[var(--background)] p-3">
                <div className="text-sm font-medium text-[var(--igh-secondary)]">Adultos</div>
                <div className="mt-2 space-y-2">
                  {Array.from({ length: adultsCount }, (_, idx) => (
                    <div key={`a-${idx}`} className="rounded-md border border-[var(--igh-border)] bg-[var(--card-bg)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-[var(--igh-muted)]">Adulto #{idx + 1}</div>
                        <div className="text-xs text-[var(--igh-muted)]">Adulto #{idx + 1}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-[var(--igh-muted)]">Tamanho camisa</div>
                          <select
                            className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
                            value={adultShirtSizes[idx] ?? "M"}
                            onChange={(e) =>
                              setAdultShirtSizes((prev) => {
                                const next = prev.slice();
                                next[idx] = e.target.value;
                                return next;
                              })
                            }
                          >
                            {["PP", "P", "M", "G", "GG", "XG"].map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--igh-muted)]">Café da manhã</div>
                          <label className="mt-2 flex items-center gap-2 text-sm text-[var(--igh-secondary)]">
                            <input
                              type="checkbox"
                              disabled={!breakfastKitAvailable}
                              checked={breakfastKitSelections[idx] ?? false}
                              onChange={(e) =>
                                setBreakfastKitSelections((prev) => {
                                  const next = prev.slice();
                                  next[idx] = e.target.checked;
                                  return next;
                                })
                              }
                            />
                            {breakfastKitAvailable ? (
                              <span>Café da manhã (+ {formatBrl(breakfastKitPrice)})</span>
                            ) : (
                              <span className="text-[var(--igh-muted)]">Indisponível</span>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {childrenCount > 0 ? (
              <div className="rounded-lg border border-[var(--igh-border)] bg-[var(--background)] p-3">
                <div className="text-sm font-medium text-[var(--igh-secondary)]">Crianças</div>
                <div className="mt-2 space-y-2">
                  {Array.from({ length: childrenCount }, (_, cidx) => {
                    const globalIdx = adultsCount + cidx;
                    return (
                      <div key={`c-${cidx}`} className="rounded-md border border-[var(--igh-border)] bg-[var(--card-bg)] p-3">
                        <div className="text-xs text-[var(--igh-muted)]">Criança #{cidx + 1}</div>
                        <div className="mt-2">
                          <div className="text-xs text-[var(--igh-muted)]">Idade / número da camisa</div>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            required
                            placeholder="Ex.: 6, 8, 10, 12"
                            className="mt-1 w-full rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm"
                            value={childrenShirtNumbers[cidx] ?? 0}
                            onChange={(e) =>
                              setChildrenShirtNumbers((prev) => {
                                const next = prev.slice();
                                next[cidx] = Number(e.target.value);
                                return next;
                              })
                            }
                          />
                        </div>
                        <div className="mt-2 text-xs text-[var(--igh-muted)]">
                          Kit café: <span className="font-medium">apenas para adultos</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {kitsDeliveryInfo ? (
          <div className="rounded-lg border border-[var(--igh-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--igh-secondary)]">
            <div className="text-xs font-medium text-[var(--igh-muted)]">Entrega dos kits</div>
            <div className="mt-1 whitespace-pre-wrap">{kitsDeliveryInfo}</div>
          </div>
        ) : null}

        {/* Kit café agora é marcado individualmente por adulto */}

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
            value={formatBrPhone(customerPhoneSnapshot)}
            inputMode="numeric"
            placeholder="(91) 99999-9999"
            onChange={(e) => setCustomerPhoneSnapshot(digitsOnly(e.target.value))}
          />
          <div className="mt-1 text-xs text-[var(--igh-muted)]">Digite um celular com DDD (11 dígitos).</div>
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
