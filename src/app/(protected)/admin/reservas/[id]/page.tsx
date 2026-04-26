import Link from "next/link";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export default async function AdminReservaDetailPage({ params }: Props) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await params;
  if (!isUuid(id)) {
    return (
      <div className="py-6 text-[var(--text-secondary)]">
        <Link href="/admin/reservas" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Reservas
        </Link>
        <p className="mt-4">ID inválido.</p>
      </div>
    );
  }

  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      package: { select: { id: true, name: true, slug: true, departureDate: true, departureTime: true, boardingLocation: true } },
      vouchers: { orderBy: [{ personType: "asc" }, { personIndex: "asc" }] },
    },
  });

  if (!r) {
    return (
      <div className="py-6 text-[var(--text-secondary)]">
        <Link href="/admin/reservas" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Reservas
        </Link>
        <p className="mt-4">Reserva não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Link href="/admin/reservas" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Reservas
        </Link>
        <div className="flex gap-2">
          <Link href={`/admin/reservas/${r.id}/pagamentos`} className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
            Pagamentos
          </Link>
        </div>
      </div>

      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Detalhes da reserva</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">Passeio</div>
          <div className="card-body text-sm">
            <div className="font-medium">{r.package.name}</div>
            <div className="mt-1 text-[var(--text-muted)]">/{r.package.slug}</div>
            <div className="mt-3">
              Saída: <span className="font-medium">{r.package.departureDate.toISOString().slice(0, 10)}</span> às{" "}
              <span className="font-medium">{r.package.departureTime}</span>
            </div>
            <div className="mt-1">Embarque: {r.package.boardingLocation}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Cliente</div>
          <div className="card-body text-sm">
            <div className="font-medium">{r.customerNameSnapshot}</div>
            <div className="mt-1 text-[var(--text-muted)]">{r.customerEmailSnapshot}</div>
            <div className="mt-1 text-[var(--text-muted)]">{r.customerPhoneSnapshot}</div>
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              Conta: {r.user.name} ({r.user.email})
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Ingressos</div>
          <div className="card-body text-sm">
            <div>
              Adultos: <span className="font-medium">{r.adultsCount}</span> · Crianças:{" "}
              <span className="font-medium">{r.childrenCount}</span> · Total: <span className="font-medium">{r.quantity}</span>
            </div>
            {r.adultShirtSizes?.length ? (
              <div className="mt-2 text-xs text-[var(--text-muted)]">Camisas adultos: {r.adultShirtSizes.join(", ")}</div>
            ) : null}
            {r.childrenShirtNumbers?.length ? (
              <div className="mt-1 text-xs text-[var(--text-muted)]">Camisas crianças (nº): {r.childrenShirtNumbers.join(", ")}</div>
            ) : null}
            {r.breakfastKitSelections?.length ? (
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                Café da manhã (adultos marcados): {r.breakfastKitSelections.filter(Boolean).length}/{r.adultsCount}
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Pagamento</div>
          <div className="card-body text-sm">
            <div>
              Status: <span className="font-medium">{r.paymentStatus}</span>
            </div>
            <div className="mt-1">
              Devido:{" "}
              <span className="font-medium">
                {Number.parseFloat(r.totalDue.toString()).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
            <div className="mt-1 text-[var(--text-muted)]">
              Pago: {Number.parseFloat(r.totalPaid.toString()).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
        </div>
      </div>

      {r.kitsDeliveryInfoSnapshot ? (
        <div className="mt-6 card">
          <div className="card-header">Entrega dos kits</div>
          <div className="card-body whitespace-pre-wrap text-sm">{r.kitsDeliveryInfoSnapshot}</div>
        </div>
      ) : null}

      {r.notes ? (
        <div className="mt-4 card">
          <div className="card-header">Observações</div>
          <div className="card-body whitespace-pre-wrap text-sm">{r.notes}</div>
        </div>
      ) : null}

      <div className="mt-6 card">
        <div className="card-header">Vouchers</div>
        <div className="card-body text-sm">
          {r.vouchers.length === 0 ? (
            <div className="text-[var(--text-muted)]">Nenhum voucher gerado ainda.</div>
          ) : (
            <div className="space-y-2">
              {r.vouchers.map((v) => {
                const label = v.personType === "ADULT" ? `Adulto #${v.personIndex + 1}` : `Criança #${v.personIndex + 1}`;
                return (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2">
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">{label}</div>
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Nº: <span className="font-mono font-semibold text-[var(--text-primary)]">{v.code}</span>
                        {" · "}Camisa: {v.shirtSize}
                        {v.personType === "CHILD" && v.age ? ` · Idade: ${v.age}` : ""}
                        {" · "}Kit café: {v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/vouchers/${encodeURIComponent(v.code)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[var(--igh-primary)] hover:underline"
                      >
                        Abrir voucher
                      </Link>
                      <span className="text-xs text-[var(--text-muted)]">{v.usedAt ? "Usado" : "Não usado"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 text-xs text-[var(--text-muted)]">
            Obs.: os vouchers são enviados por e-mail automaticamente quando o pagamento fica 100% quitado.
          </div>
        </div>
      </div>
    </div>
  );
}

