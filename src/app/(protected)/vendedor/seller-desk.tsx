"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import { displayCustomerEmail } from "@/lib/customer-placeholder-email";
import { isFreeChildAge } from "@/lib/vouchers/shirt";

type Customer = { id: string; name: string; email: string; phone: string | null; cpf: string | null };

type PackageItem = {
  id: string;
  name: string;
  price: string;
  childPrice: string;
  breakfastKitAvailable: boolean;
  breakfastKitPrice: string;
  kitsDeliveryInfo: string | null;
  departureDateLabel: string;
  departureTime: string;
  boardingLocation: string;
  remainingPlaces: number;
};

type VoucherLine = { code: string; name: string; personType: string; released: boolean };

type SaleReceipt = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  quantity: number;
  adultsCount: number;
  childrenCount: number;
  kitCount: number;
  totalDue: string;
  paymentMethodLabel: string;
  packageName: string;
  departureLabel: string;
  boardingLocation: string;
  adultNames?: string[];
  childrenNames?: string[];
  childrenAges?: number[];
  vouchers?: VoucherLine[];
};

const ADULT_SIZES = ["PP", "P", "M", "G", "GG", "XG"];
const CHILD_SIZES = [2, 4, 6, 8, 10, 12, 14];

function brl(value: string | number): string {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function digitsOnly(s: string): string {
  return (s ?? "").replace(/\D/g, "").slice(0, 11);
}

function formatBrPhone(value: string): string {
  const d = digitsOnly(value);
  if (d.length <= 2) return d;
  const dd = d.slice(0, 2);
  if (d.length <= 7) return `(${dd}) ${d.slice(2)}`;
  return `(${dd}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function customerWhatsAppHref(phone: string, text: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  const withCountry = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

export function SellerDesk() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [packageId, setPackageId] = useState("");
  const pkg = packages.find((p) => p.id === packageId) ?? null;

  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [adultNames, setAdultNames] = useState<string[]>([""]);
  const [adultShirtSizes, setAdultShirtSizes] = useState<string[]>(["M"]);
  const [childrenNames, setChildrenNames] = useState<string[]>([]);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [childrenShirtNumbers, setChildrenShirtNumbers] = useState<number[]>([]);
  const [breakfastKitSelections, setBreakfastKitSelections] = useState<boolean[]>([false]);
  const [payMethod, setPayMethod] = useState<"PIX" | "DINHEIRO" | "CARTAO">("PIX");
  const [installments, setInstallments] = useState(1);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

  const maxQty = pkg?.remainingPlaces ?? 1;
  const quantity = adultsCount + childrenCount;

  const loadPackages = useCallback(async () => {
    const res = await fetch("/api/vendedor/pacotes");
    const json = (await res.json()) as ApiResponse<{ items: PackageItem[] }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao carregar pacotes.");
      return;
    }
    setPackages(json.data.items);
    setPackageId((curr) => curr || json.data.items[0]?.id || "");
  }, [toast]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    const t = setTimeout(() => {
      const term = q.trim();
      const d = digitsOnly(term);
      if (term.length < 2 && d.length < 8) {
        setResults([]);
        return;
      }
      setSearching(true);
      void fetch(`/api/vendedor/clientes?q=${encodeURIComponent(term)}`)
        .then(async (res) => {
          const json = (await res.json()) as ApiResponse<{ items: Customer[] }>;
          if (res.ok && json.ok) setResults(json.data.items);
        })
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setAdultNames((prev) => {
      const next = prev.slice(0, adultsCount);
      while (next.length < adultsCount) next.push(customer?.name && next.length === 0 ? customer.name : "");
      return next;
    });
    setAdultShirtSizes((prev) => {
      const next = prev.slice(0, adultsCount);
      while (next.length < adultsCount) next.push("M");
      return next;
    });
    setBreakfastKitSelections((prev) => {
      const next = prev.slice(0, adultsCount);
      while (next.length < adultsCount) next.push(false);
      return next;
    });
    setChildrenNames((prev) => {
      const next = prev.slice(0, childrenCount);
      while (next.length < childrenCount) next.push("");
      return next;
    });
    setChildrenAges((prev) => {
      const next = prev.slice(0, childrenCount);
      while (next.length < childrenCount) next.push(6);
      return next;
    });
    setChildrenShirtNumbers((prev) => {
      const next = prev.slice(0, childrenCount);
      while (next.length < childrenCount) next.push(8);
      return next;
    });
  }, [adultsCount, childrenCount, customer?.name]);

  useEffect(() => {
    if (customer && adultsCount > 0 && !adultNames[0]) {
      setAdultNames((prev) => {
        const next = [...prev];
        next[0] = customer.name;
        return next;
      });
    }
  }, [customer, adultsCount, adultNames]);

  const estimatedTotal = useMemo(() => {
    if (!pkg) return 0;
    const adultUnit = Number.parseFloat(pkg.price) || 0;
    const childUnit = Number.parseFloat(pkg.childPrice) || 0;
    const kitUnit = pkg.breakfastKitAvailable ? Number.parseFloat(pkg.breakfastKitPrice) || 0 : 0;
    const paidChildren = childrenAges.slice(0, childrenCount).filter((age) => age >= 6).length;
    const kits = pkg.breakfastKitAvailable ? breakfastKitSelections.filter(Boolean).length : 0;
    return adultUnit * adultsCount + childUnit * paidChildren + kitUnit * kits;
  }, [pkg, adultsCount, childrenCount, childrenAges, breakfastKitSelections]);

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/vendedor/clientes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          phone: digitsOnly(newPhone),
          cpf: digitsOnly(newCpf) || null,
          email: newEmail.trim(),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ item: Customer; reused?: boolean }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao cadastrar.");
        return;
      }
      setCustomer(json.data.item);
      setResults([]);
      setQ("");
      toast.push("success", json.data.reused ? "Cliente já existia — selecionado." : "Cliente cadastrado.");
    } finally {
      setCreating(false);
    }
  }

  function clampPeople(nextA: number, nextC: number) {
    let a = Math.max(0, nextA);
    let c = Math.max(0, nextC);
    if (a + c === 0) a = 1;
    if (a + c > maxQty) {
      c = Math.max(0, maxQty - a);
      if (a + c > maxQty) a = maxQty;
    }
    setAdultsCount(a);
    setChildrenCount(c);
  }

  async function submitSale(e: React.FormEvent) {
    e.preventDefault();
    if (!customer || !pkg || saving) return;
    if (quantity < 1 || quantity > maxQty) {
      toast.push("error", "Quantidade inválida para as vagas restantes.");
      return;
    }
    for (let i = 0; i < adultsCount; i++) {
      if (!adultNames[i]?.trim()) {
        toast.push("error", `Informe o nome do adulto ${i + 1}.`);
        return;
      }
    }
    for (let i = 0; i < childrenCount; i++) {
      if (!childrenNames[i]?.trim()) {
        toast.push("error", `Informe o nome da criança ${i + 1}.`);
        return;
      }
      const age = childrenAges[i] ?? 0;
      if (!Number.isInteger(age) || age < 0 || age > 10) {
        toast.push("error", "Idade da criança deve ser entre 0 e 10 anos.");
        return;
      }
      if (!isFreeChildAge(age) && !(childrenShirtNumbers[i] > 0)) {
        toast.push("error", `Informe a camisa da criança ${i + 1}.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/vendedor/vendas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: customer.id,
          packageId: pkg.id,
          quantity,
          adultsCount,
          childrenCount,
          adultNames,
          adultShirtSizes,
          childrenNames,
          childrenAges,
          childrenShirtNumbers,
          breakfastKitSelections: pkg.breakfastKitAvailable ? breakfastKitSelections : adultNames.map(() => false),
          paymentPreferenceMethod: payMethod,
          paymentPreferenceInstallments: payMethod === "CARTAO" ? installments : null,
          customerNameSnapshot: customer.name,
          customerEmailSnapshot: customer.email,
          customerPhoneSnapshot: customer.phone ?? digitsOnly(newPhone),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ sale: SaleReceipt }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao lançar a venda.");
        return;
      }
      setReceipt(json.data.sale);
      toast.push("success", "Venda lançada e pagamento no stand confirmado.");
      void loadPackages();
    } finally {
      setSaving(false);
    }
  }

  function resetForNextSale() {
    setReceipt(null);
    setCustomer(null);
    setAdultsCount(1);
    setChildrenCount(0);
    setPayMethod("PIX");
    void loadPackages();
  }

  if (receipt) {
    const whatsappText = [
      `Romaria — pagamento no stand`,
      receipt.packageName,
      receipt.departureLabel,
      `Total: ${brl(receipt.totalDue)} (${receipt.paymentMethodLabel})`,
      ...(receipt.vouchers?.length
        ? ["Ingressos:", ...receipt.vouchers.map((v) => `${v.code} — ${v.name}`)]
        : []),
    ].join("\n");
    const whatsappHref = customerWhatsAppHref(receipt.customerPhone, whatsappText);

    return (
      <div className="py-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 print:border-0 print:bg-white dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
            Comprovante do stand
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Pagamento recebido</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {receipt.packageName} · {receipt.departureLabel}
          </p>
          <div className="mt-4 grid gap-2 text-sm text-[var(--text-primary)]">
            <div>
              <span className="text-[var(--text-muted)]">Cliente:</span> {receipt.customerName}
            </div>
            <div>
              <span className="text-[var(--text-muted)]">WhatsApp:</span> {receipt.customerPhone}
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Embarque:</span> {receipt.boardingLocation}
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Pessoas:</span> {receipt.adultsCount} adulto(s)
              {receipt.childrenCount ? ` · ${receipt.childrenCount} criança(s)` : ""}
              {receipt.kitCount ? ` · ${receipt.kitCount} kit café` : ""}
            </div>
            <div className="text-lg font-semibold">
              Total pago no stand: {brl(receipt.totalDue)} ({receipt.paymentMethodLabel})
            </div>
          </div>
          {receipt.vouchers?.length ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">Ingressos</p>
              <ul className="mt-1 list-none pl-0 text-sm">
                {receipt.vouchers.map((v) => (
                  <li key={v.code}>
                    <span className="font-mono font-semibold">{v.code}</span> — {v.name}
                    {v.released ? "" : " (aguardando liberação)"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Se o cliente tem e-mail válido, o voucher também é enviado automaticamente.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <Button type="button" onClick={() => window.print()}>
            Imprimir comprovante
          </Button>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary">
                Enviar no WhatsApp
              </Button>
            </a>
          ) : null}
          <Button type="button" variant="secondary" onClick={resetForNextSale}>
            Nova venda
          </Button>
          <Link href="/vendedor/vendas">
            <Button type="button" variant="secondary">
              Minhas vendas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Nova venda</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
        Busque o cliente, lance o pacote ativo e confirme o recebimento do valor exibido. Não é possível alterar preço,
        dar desconto ou acessar o caixa.
      </p>

      <section className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">1. Cliente</h2>
        {customer ? (
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-medium text-[var(--text-primary)]">{customer.name}</div>
              <div className="text-sm text-[var(--text-muted)]">{customer.phone ?? "Sem WhatsApp"}</div>
              <div className="text-sm text-[var(--text-muted)]">{displayCustomerEmail(customer.email)}</div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setCustomer(null)}>
              Trocar cliente
            </Button>
          </div>
        ) : (
          <>
            <label className="mt-3 block text-sm font-medium">Buscar por nome, WhatsApp ou CPF</label>
            <Input className="mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite para buscar…" />
            {searching ? <p className="mt-2 text-xs text-[var(--text-muted)]">Buscando…</p> : null}
            {results.length > 0 ? (
              <ul className="mt-3 list-none divide-y divide-[var(--card-border)] rounded-lg border border-[var(--card-border)] pl-0">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left hover:bg-[var(--igh-surface)]"
                      onClick={() => {
                        setCustomer(c);
                        setResults([]);
                        setQ("");
                      }}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {c.phone ?? "—"} · {displayCustomerEmail(c.email)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(e) => void createCustomer(e)}>
              <p className="sm:col-span-2 text-sm font-medium text-[var(--text-primary)]">Se não aparecer, cadastre:</p>
              <div>
                <label className="text-sm">Nome completo</label>
                <Input className="mt-1" required value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">WhatsApp</label>
                <Input
                  className="mt-1"
                  required
                  value={formatBrPhone(newPhone)}
                  onChange={(e) => setNewPhone(digitsOnly(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm">CPF (recomendado)</label>
                <Input className="mt-1" value={newCpf} onChange={(e) => setNewCpf(digitsOnly(e.target.value))} />
              </div>
              <div>
                <label className="text-sm">E-mail (opcional)</label>
                <Input className="mt-1" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={creating || newName.trim().length < 2 || digitsOnly(newPhone).length !== 11}>
                  {creating ? "Salvando…" : "Cadastrar e usar este cliente"}
                </Button>
              </div>
            </form>
          </>
        )}
      </section>

      <form className="mt-6 space-y-6" onSubmit={(e) => void submitSale(e)}>
        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">2. Pacote e pessoas</h2>
          {packages.length === 0 ? (
            <p className="mt-3 text-sm text-amber-800">Nenhum pacote aberto com vaga no momento.</p>
          ) : (
            <>
              <label className="mt-3 block text-sm font-medium">Pacote ativo</label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.departureDateLabel} {p.departureTime} — adulto {brl(p.price)} — {p.remainingPlaces} vaga(s)
                  </option>
                ))}
              </select>
              {pkg ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Adulto {brl(pkg.price)} · Criança 6–10 anos {brl(pkg.childPrice)} · Menor de 6 anos grátis
                  {pkg.breakfastKitAvailable ? ` · Kit café ${brl(pkg.breakfastKitPrice)} (opcional)` : ""}
                  <br />
                  Embarque: {pkg.boardingLocation}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm">Adultos</label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={maxQty}
                    value={adultsCount}
                    onChange={(e) => clampPeople(Number(e.target.value), childrenCount)}
                  />
                </div>
                <div>
                  <label className="text-sm">Crianças (até 10 anos)</label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={maxQty}
                    value={childrenCount}
                    onChange={(e) => clampPeople(adultsCount, Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {Array.from({ length: adultsCount }).map((_, idx) => (
                  <div key={`a-${idx}`} className="grid gap-2 rounded-lg border border-[var(--card-border)] p-3 sm:grid-cols-[1fr_8rem_auto]">
                    <div>
                      <label className="text-xs text-[var(--text-muted)]">Adulto {idx + 1}</label>
                      <Input
                        className="mt-1"
                        value={adultNames[idx] ?? ""}
                        onChange={(e) =>
                          setAdultNames((prev) => {
                            const next = [...prev];
                            next[idx] = e.target.value;
                            return next;
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-muted)]">Camisa</label>
                      <select
                        className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-2 text-sm"
                        value={adultShirtSizes[idx] ?? "M"}
                        onChange={(e) =>
                          setAdultShirtSizes((prev) => {
                            const next = [...prev];
                            next[idx] = e.target.value;
                            return next;
                          })
                        }
                      >
                        {ADULT_SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    {pkg?.breakfastKitAvailable ? (
                      <label className="flex items-end gap-2 pb-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(breakfastKitSelections[idx])}
                          onChange={(e) =>
                            setBreakfastKitSelections((prev) => {
                              const next = [...prev];
                              next[idx] = e.target.checked;
                              return next;
                            })
                          }
                        />
                        Kit café
                      </label>
                    ) : null}
                  </div>
                ))}
                {Array.from({ length: childrenCount }).map((_, idx) => {
                  const age = childrenAges[idx] ?? 6;
                  const free = isFreeChildAge(age);
                  return (
                    <div key={`c-${idx}`} className="grid gap-2 rounded-lg border border-[var(--card-border)] p-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">Criança {idx + 1}</label>
                        <Input
                          className="mt-1"
                          value={childrenNames[idx] ?? ""}
                          onChange={(e) =>
                            setChildrenNames((prev) => {
                              const next = [...prev];
                              next[idx] = e.target.value;
                              return next;
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">Idade</label>
                        <Input
                          className="mt-1"
                          type="number"
                          min={0}
                          max={10}
                          value={age}
                          onChange={(e) =>
                            setChildrenAges((prev) => {
                              const next = [...prev];
                              next[idx] = Number.parseInt(e.target.value, 10) || 0;
                              return next;
                            })
                          }
                        />
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{free ? "Grátis (menor de 6)" : "50% do adulto"}</p>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">Camisa</label>
                        {free ? (
                          <p className="mt-2 text-sm text-[var(--text-muted)]">Sem camisa</p>
                        ) : (
                          <select
                            className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-2 text-sm"
                            value={childrenShirtNumbers[idx] ?? 8}
                            onChange={(e) =>
                              setChildrenShirtNumbers((prev) => {
                                const next = [...prev];
                                next[idx] = Number(e.target.value);
                                return next;
                              })
                            }
                          >
                            {CHILD_SIZES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">3. Recebimento no stand</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">O valor é calculado pelo sistema e não pode ser alterado.</p>
          <div className="mt-3 text-3xl font-bold tabular-nums text-[var(--text-primary)]">{brl(estimatedTotal)}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm">Como o cliente pagou</label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
              >
                <option value="PIX">Pix</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
              </select>
            </div>
            {payMethod === "CARTAO" ? (
              <div>
                <label className="text-sm">Parcelas na maquininha</label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  max={12}
                  value={installments}
                  onChange={(e) => setInstallments(Number.parseInt(e.target.value, 10) || 1)}
                />
              </div>
            ) : null}
          </div>
          <Button
            className="mt-5"
            type="submit"
            disabled={!customer || !pkg || saving || packages.length === 0}
          >
            {saving ? "Confirmando…" : `Confirmar recebimento de ${brl(estimatedTotal)}`}
          </Button>
        </section>
      </form>
    </div>
  );
}
