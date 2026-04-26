"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { PackageReservationForm } from "@/components/site/PackageReservationForm";
import type { ApiResponse } from "@/lib/api-types";
import { displayCustomerEmail, isCustomerPlaceholderEmail } from "@/lib/customer-placeholder-email";

type CustomerHead = { id: string; name: string; email: string; phone: string | null; cpf: string | null };

type PackageListItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  isActive: boolean;
  departureDate: string;
  price: string;
  childPrice: string;
  breakfastKitPrice: string;
  breakfastKitAvailable: boolean;
};

type PackageDetail = PackageListItem & {
  capacity: number;
  kitsDeliveryInfo: string | null;
  remainingPlaces: number | null;
};

function formatYmd(d: string | Date): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

export default function AdminClienteNovaReservaPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerHead | null>(null);
  const [packages, setPackages] = useState<PackageListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const openPackages = useMemo(
    () => packages.filter((p) => p.status === "OPEN" && p.isActive).sort((a, b) => formatYmd(a.departureDate).localeCompare(formatYmd(b.departureDate))),
    [packages]
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/admin/customers/${id}`),
        fetch("/api/admin/packages"),
      ]);
      const cJson = (await cRes.json()) as ApiResponse<{ item: CustomerHead }>;
      const pJson = (await pRes.json()) as ApiResponse<{ items: PackageListItem[] }>;
      if (!cRes.ok || !cJson.ok) {
        toast.push("error", !cJson.ok ? cJson.error.message : "Cliente não encontrado.");
        setCustomer(null);
        return;
      }
      if (!pRes.ok || !pJson.ok) {
        toast.push("error", "Falha ao carregar pacotes.");
        setCustomer(cJson.data.item);
        return;
      }
      setCustomer(cJson.data.item);
      setPackages(pJson.data.items);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/packages/${selectedId}`);
        const json = (await res.json()) as ApiResponse<{ item: PackageDetail }>;
        if (!res.ok || !json.ok) {
          toast.push("error", "Falha ao carregar o pacote.");
          setDetail(null);
          return;
        }
        setDetail(json.data.item);
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [selectedId, toast]);

  const defaultEmail = customer?.email && !isCustomerPlaceholderEmail(customer.email) ? customer.email : customer?.email ?? "";
  const defaultPhone = customer?.phone ?? "";
  const defaultName = customer?.name ?? "";

  return (
    <div className="py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/admin/clientes/${id}`} className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Ficha do cliente
        </Link>
      </div>

      {loading || !customer ? (
        <p className="text-[var(--text-secondary)]">Carregando…</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Nova reserva</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Cliente: <span className="font-medium text-[var(--text-primary)]">{customer.name}</span> · {displayCustomerEmail(customer.email)} · {customer.phone ?? "—"}
          </p>

          {openPackages.length === 0 ? (
            <p className="mt-6 text-[var(--text-secondary)]">Não há pacotes abertos e ativos no momento.</p>
          ) : (
            <div className="mt-6 max-w-lg">
              <label className="text-sm font-medium text-[var(--text-primary)]">Passeio</label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">Selecione o pacote…</option>
                {openPackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — saída {formatYmd(p.departureDate)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedId && loadingDetail ? <p className="mt-6 text-sm text-[var(--text-secondary)]">Carregando detalhes…</p> : null}

          {detail && !loadingDetail ? (
            <div className="mt-8 max-w-2xl">
              <PackageReservationForm
                packageId={detail.id}
                slug={detail.slug}
                loggedIn
                adminForUserId={id}
                breakfastKitAvailable={detail.breakfastKitAvailable}
                breakfastKitPrice={detail.breakfastKitPrice}
                unitPrice={detail.price}
                remainingPlaces={detail.remainingPlaces}
                kitsDeliveryInfo={detail.kitsDeliveryInfo}
                defaultName={defaultName}
                defaultEmail={defaultEmail}
                defaultPhone={defaultPhone}
                onAdminReservationCreated={(reservationId) => {
                  router.push(`/admin/reservas/${reservationId}/pagamentos`);
                }}
              />
            </div>
          ) : null}

          <div className="mt-8">
            <Link
              href={`/admin/clientes/${id}`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
            >
              Cancelar
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
