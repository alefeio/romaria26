import "server-only";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { getSessionUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/email";
import { BRAZIL_TIMEZONE } from "@/lib/datetime-brazil";

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

export default async function ClienteVoucherPage({ params }: Props) {
  const user = await getSessionUserFromCookie();
  if (!user) redirect("/login");
  if (user.role === "ADMIN" || user.role === "MASTER") {
    const { code } = await params;
    const c = decodeURIComponent(code ?? "").trim();
    if (!c) notFound();
    redirect(`/admin/vouchers/${encodeURIComponent(c)}`);
  }
  if (user.role !== "CUSTOMER") notFound();
  const { code } = await params;
  const c = decodeURIComponent(code ?? "").trim();
  if (!c) notFound();

  const v = await prisma.reservationVoucher.findFirst({
    where: { code: c },
    include: {
      reservation: {
        select: {
          id: true,
          userId: true,
          paymentStatus: true,
          package: { select: { name: true, slug: true, departureDate: true, departureTime: true, boardingLocation: true } },
        },
      },
    },
  });
  if (!v) notFound();
  if (v.reservation.userId !== user.id) {
    return (
      <main className="container-page py-8">
        <div className="mb-4">
          <Link href="/cliente/reservas" className="text-sm text-[var(--igh-primary)] hover:underline">
            ← Minhas reservas
          </Link>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <h1 className="text-xl font-semibold text-amber-900 dark:text-amber-100">Você não tem acesso a este voucher</h1>
          <p className="mt-2 text-sm text-amber-800/90 dark:text-amber-200/90">
            Este voucher pertence a outra conta. Volte para <span className="font-medium">Minhas reservas</span> para acessar seus vouchers.
          </p>
          <div className="mt-4">
            <Link href="/cliente/reservas" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
              Ir para Minhas reservas
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const ordered = await prisma.reservationVoucher.findMany({
    where: { reservationId: v.reservationId },
    orderBy: [{ personType: "asc" }, { personIndex: "asc" }],
    select: { code: true },
  });
  const codes = ordered.map((x) => x.code);
  const idx = codes.indexOf(v.code);
  const nextCode = idx >= 0 && idx < codes.length - 1 ? codes[idx + 1] : null;

  const base = await resolvePublicAppUrl();
  const checkinUrl = `${base}/admin/vouchers/${encodeURIComponent(v.code)}/checkin`;
  const canValidate = v.reservation.paymentStatus === "PAID";
  const qrDataUrl = v.usedAt || !canValidate ? null : await QRCode.toDataURL(checkinUrl, { margin: 1, scale: 8 });
  const label = v.personType === "ADULT" ? `Adulto #${v.personIndex + 1}` : `Criança #${v.personIndex + 1}`;
  const age = v.personType === "CHILD" && v.age ? v.age : null;

  return (
    <main className="container-page py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/cliente/reservas" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Minhas reservas
        </Link>
        {nextCode ? (
          <Link href={`/cliente/vouchers/${encodeURIComponent(nextCode)}`} className="text-sm text-[var(--igh-primary)] hover:underline">
            Próximo →
          </Link>
        ) : null}
      </div>

      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Meu voucher</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Passeio: <span className="font-medium">{v.reservation.package.name}</span> ·{" "}
        {formatWhen(v.reservation.package.departureDate, v.reservation.package.departureTime)}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">QR Code</div>
          {v.usedAt ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Este voucher já foi utilizado. O QR Code não está mais disponível.
            </div>
          ) : !canValidate ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Este voucher ainda não pode ser validado. Para liberar a validação, o valor pendente precisa estar <strong>100% quitado</strong>.
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl ?? undefined}
                alt="QR Code do voucher"
                className="mt-3 h-64 w-64 rounded-lg border border-[var(--card-border)] bg-white object-contain"
              />
              <div className="mt-3 text-xs text-[var(--text-muted)]">
                Apresente na entrada para validação pelo administrador.
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
          <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{v.name}</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            Nº <span className="font-mono font-semibold">{v.code}</span> · Camisa {v.shirtSize} · Kit café{" "}
            {v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—"}
            {age !== null ? ` · Idade ${age}` : ""}
          </div>
          <div className="mt-4 text-sm text-[var(--text-secondary)]">
            Status de uso: <span className="font-medium">{v.usedAt ? "Usado" : "Não usado"}</span>
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            Pagamento da reserva: <span className="font-medium">{v.reservation.paymentStatus}</span>
          </div>
          {canValidate && !v.usedAt ? (
            <div className="mt-4 text-xs text-[var(--text-muted)] break-all">{checkinUrl}</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

