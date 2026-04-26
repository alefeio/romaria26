import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";
import { BRAZIL_TIMEZONE } from "@/lib/datetime-brazil";
import { getSessionUserFromCookie } from "@/lib/auth";
import { resolvePublicAppUrl } from "@/lib/email";

type Props = { params: Promise<{ code: string }> };

function formatWhen(d: Date, time: string): string {
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  return `${date} às ${time}`;
}

export default async function VoucherPage({ params }: Props) {
  const { code } = await params;
  const c = decodeURIComponent(code ?? "").trim();
  if (!c) notFound();

  const session = await getSessionUserFromCookie();
  const v = await prisma.reservationVoucher.findFirst({
    where: { code: c },
    include: {
      reservation: {
        select: {
          id: true,
          customerNameSnapshot: true,
          userId: true,
          package: { select: { name: true, departureDate: true, departureTime: true, boardingLocation: true } },
        },
      },
    },
  });
  if (!v) notFound();

  // Clientes só podem ver o próprio voucher (para não expor dados pessoais).
  if (session?.role === "CUSTOMER" && v.reservation.userId !== session.id) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Acesso restrito</div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Voucher indisponível</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Você não tem permissão para ver este voucher.</p>
          <div className="mt-4">
            <Link href="/cliente/reservas" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
              Ir para Minhas reservas
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Link de check-in é ADMIN-only; o QR Code deve apontar para ele.
  const base = await resolvePublicAppUrl();
  const checkinUrl = `${base}/admin/vouchers/${encodeURIComponent(v.code)}/checkin`;
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, { margin: 1, scale: 8 });
  const label = v.personType === "ADULT" ? `Adulto #${v.personIndex + 1}` : `Criança #${v.personIndex + 1}`;
  const age = v.personType === "CHILD" && v.age ? v.age : null;

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Voucher</div>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{v.reservation.package.name}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {formatWhen(v.reservation.package.departureDate, v.reservation.package.departureTime)} · Embarque:{" "}
          {v.reservation.package.boardingLocation}
        </p>

        <div className="mt-6 grid gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR Code do voucher" className="h-64 w-64 rounded-lg border border-[var(--card-border)] bg-white object-contain" />
            <div className="text-xs text-[var(--text-muted)]">
              Apresente este QR Code na entrada para validação pelo administrador.
            </div>
          </div>

          <div>
            <div className="text-xs text-[var(--text-muted)]">{label}</div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{v.name}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-[var(--text-muted)]">Camisa</div>
              <div className="font-medium text-[var(--text-primary)]">{v.shirtSize}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Kit café</div>
              <div className="font-medium text-[var(--text-primary)]">
                {v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—"}
              </div>
            </div>
            {age !== null ? (
              <div>
                <div className="text-xs text-[var(--text-muted)]">Idade</div>
                <div className="font-medium text-[var(--text-primary)]">{age}</div>
              </div>
            ) : null}
            <div>
              <div className="text-xs text-[var(--text-muted)]">Número</div>
              <div className="font-mono font-semibold text-[var(--text-primary)]">{v.code}</div>
            </div>
          </div>

          <div className="text-xs text-[var(--text-muted)] break-all">{checkinUrl}</div>
        </div>

        <p className="mt-6 text-sm text-[var(--text-muted)]">
          Status de uso: <span className="font-medium">{v.usedAt ? "Usado" : "Não usado"}</span>
        </p>
      </div>
    </main>
  );
}

