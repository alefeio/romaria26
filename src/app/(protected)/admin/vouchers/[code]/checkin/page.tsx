import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTimeBr } from "@/lib/datetime-brazil";
import { createAuditLog } from "@/lib/audit";
import { findVoucherByCode } from "@/lib/vouchers/find-voucher-by-code";

type Props = { params: Promise<{ code: string }> };

export default async function AdminVoucherCheckinPage({ params }: Props) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { code } = await params;
  const c = decodeURIComponent(code ?? "").trim();
  if (!c) notFound();

  const resolved = await findVoucherByCode(c);
  if (!resolved) notFound();

  if (resolved.kind === "collaborator") {
    const collab = resolved.collaborator;
    const wasUsed = Boolean(collab.usedAt);
    const canCheckIn = !wasUsed;
    const now = new Date();

    const updated =
      canCheckIn && !wasUsed
        ? await prisma.eventCollaborator.update({
            where: { id: collab.id },
            data: { usedAt: now },
            include: {
              package: { select: { name: true, slug: true, departureDate: true } },
            },
          })
        : collab;

    if (canCheckIn && !wasUsed) {
      await createAuditLog({
        entityType: "EventCollaborator",
        entityId: updated.id,
        action: "COLLABORATOR_VOUCHER_CHECKIN",
        diff: { code: updated.code, usedAt: now.toISOString() },
        performedByUserId: user.id,
      });
    }

    return (
      <div className="py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/colaboradores" className="text-sm text-[var(--igh-primary)] hover:underline">
            ← Colaboradores
          </Link>
          <Link
            href={`/admin/vouchers/${encodeURIComponent(updated.code)}`}
            className="text-sm text-[var(--igh-primary)] hover:underline"
          >
            Ver voucher
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Check-in — colaborador</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Passeio: <span className="font-medium">{updated.package.name}</span> · Equipe do evento
        </p>

        <div className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Colaborador</div>
          <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{updated.name}</div>
          {updated.roleLabel ? (
            <div className="mt-1 text-sm text-[var(--text-secondary)]">Função: {updated.roleLabel}</div>
          ) : null}
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            Número: <span className="font-mono font-semibold">{updated.code}</span>
          </div>

          <div className="mt-4">
            {updated.usedAt ? (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                {wasUsed ? (
                  <>
                    Voucher já estava como <strong>Usado</strong> (em {formatDateTimeBr(updated.usedAt)}).
                  </>
                ) : (
                  <>
                    Check-in realizado. Status alterado para <strong>Usado</strong> em{" "}
                    {formatDateTimeBr(updated.usedAt)}.
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                Check-in realizado com sucesso.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const v = resolved.voucher;
  const wasUsed = Boolean(v.usedAt);
  const canCheckIn = Boolean(v.releasedAt) && !wasUsed;
  const now = new Date();

  const updated =
    canCheckIn && !wasUsed
      ? await prisma.reservationVoucher.update({
          where: { id: v.id },
          data: { usedAt: now },
          include: {
            reservation: {
              select: {
                id: true,
                customerNameSnapshot: true,
                paymentStatus: true,
                package: { select: { name: true, slug: true, departureDate: true } },
              },
            },
          },
        })
      : v;

  if (canCheckIn && !wasUsed) {
    await createAuditLog({
      entityType: "ReservationVoucher",
      entityId: updated.id,
      action: "VOUCHER_CHECKIN_USED",
      diff: { code: updated.code, reservationId: updated.reservationId, usedAt: now.toISOString() },
      performedByUserId: user.id,
    });
  }

  const label =
    updated.personType === "ADULT" ? `Adulto #${updated.personIndex + 1}` : `Criança #${updated.personIndex + 1}`;

  return (
    <div className="py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/reservas" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Reservas
        </Link>
        <Link href={`/admin/reservas/${updated.reservation.id}`} className="text-sm text-[var(--igh-primary)] hover:underline">
          Ver reserva
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Check-in do voucher</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Passeio: <span className="font-medium">{updated.reservation.package.name}</span> · Cliente:{" "}
        <span className="font-medium">{updated.reservation.customerNameSnapshot}</span>
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
        <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{updated.name}</div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">
          Número: <span className="font-mono font-semibold">{updated.code}</span>
        </div>

        <div className="mt-4">
          {!v.releasedAt && !wasUsed ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Check-in bloqueado: este ingresso ainda não foi liberado (reserva com pagamento pendente — status{" "}
              <strong>{updated.reservation.paymentStatus}</strong>).
            </div>
          ) : updated.usedAt ? (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${wasUsed ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"}`}
            >
              {wasUsed ? (
                <>
                  Voucher já estava como <strong>Usado</strong> (em {formatDateTimeBr(updated.usedAt)}).
                </>
              ) : (
                <>
                  Check-in realizado. Status alterado para <strong>Usado</strong> em {formatDateTimeBr(updated.usedAt)}.
                </>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-100">
              Não foi possível marcar como usado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
