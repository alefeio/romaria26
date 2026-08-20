import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";
import { BRAZIL_TIMEZONE } from "@/lib/datetime-brazil";
import { getSessionUserFromCookie, verifyPassword } from "@/lib/auth";
import { resolvePublicAppUrl } from "@/lib/email";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function formatWhen(d: Date, time: string): string {
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  return `${date} às ${time}`;
}

function accessDeniedCard(opts: { title: string; body: string; showLogin?: boolean }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Acesso restrito</div>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{opts.title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{opts.body}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {opts.showLogin ? (
            <Link href="/login" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
              Entrar
            </Link>
          ) : null}
          <Link href="/" className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--igh-primary)] hover:underline">
            Início
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function VoucherPage({ params, searchParams }: Props) {
  const { code } = await params;
  const c = decodeURIComponent(code ?? "").trim();
  if (!c) notFound();

  const session = await getSessionUserFromCookie();
  const sp = await searchParams;
  const sharedId = typeof sp.s === "string" ? sp.s.trim() : "";
  const sharedPass = typeof sp.p === "string" ? sp.p.trim() : "";

  const v = await prisma.reservationVoucher.findFirst({
    where: { code: c },
    include: {
      reservation: {
        select: {
          id: true,
          customerNameSnapshot: true,
          userId: true,
          paymentStatus: true,
          package: { select: { name: true, departureDate: true, departureTime: true, boardingLocation: true } },
        },
      },
    },
  });
  if (!v) notFound();

  const hasAnyShareParam = Boolean(sharedId || sharedPass);
  const hasFullShareParams = Boolean(sharedId && sharedPass);

  if (hasAnyShareParam && !hasFullShareParams) {
    return accessDeniedCard({
      title: "Link incompleto",
      body: "O link de compartilhamento está incompleto. Use o link completo enviado por WhatsApp (com os parâmetros de acesso).",
    });
  }

  let shareAccessOk = false;
  if (hasFullShareParams) {
    const share = await prisma.reservationVoucherShare.findFirst({
      where: { id: sharedId, voucherId: v.id },
      select: { passwordHash: true, expiresAt: true },
    });
    shareAccessOk = Boolean(
      share &&
        share.expiresAt.getTime() > Date.now() &&
        (await verifyPassword(sharedPass, share.passwordHash))
    );
    if (!shareAccessOk) {
      return (
        <main className="mx-auto max-w-xl px-4 py-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
              Acesso por compartilhamento
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-amber-900 dark:text-amber-100">Senha inválida ou expirada</h1>
            <p className="mt-2 text-sm text-amber-800/90 dark:text-amber-200/90">
              Peça para o responsável compartilhar novamente o voucher para gerar uma nova senha temporária.
            </p>
          </div>
        </main>
      );
    }
  }

  const isStaff =
    session &&
    (session.role === "MASTER" || session.role === "ADMIN" || session.isAdmin === true || session.baseRole === "MASTER");
  const isOwner = session?.role === "CUSTOMER" && v.reservation.userId === session.id;

  const canView = shareAccessOk || Boolean(isStaff) || Boolean(isOwner);

  if (!canView) {
    if (!session) {
      return accessDeniedCard({
        title: "Voucher privado",
        body:
          "Este ingresso não pode ser aberto só pelo número na URL. Entre na sua conta (dono da reserva) ou use o link completo compartilhado por WhatsApp, com senha temporária.",
        showLogin: true,
      });
    }
    if (session.role === "CUSTOMER") {
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
    return accessDeniedCard({
      title: "Acesso negado",
      body: "Você não tem permissão para visualizar este voucher.",
    });
  }

  const base = await resolvePublicAppUrl();
  const checkinUrl = `${base}/admin/vouchers/${encodeURIComponent(v.code)}/checkin`;
  const canValidate = Boolean(v.releasedAt);
  const qrDataUrl =
    v.usedAt || !canValidate ? null : await QRCode.toDataURL(checkinUrl, { margin: 1, scale: 8 });
  const label = v.personType === "ADULT" ? `Adulto #${v.personIndex + 1}` : `Criança #${v.personIndex + 1}`;
  const age = v.personType === "CHILD" && v.age != null ? v.age : null;

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
            {v.usedAt ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Este voucher já foi utilizado. O QR Code não está mais disponível.
              </div>
            ) : !canValidate ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Este ingresso ainda não está liberado. O valor pendente da reserva precisa estar{" "}
                <strong>100% quitado</strong> para liberar validação.
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl ?? undefined} alt="QR Code do voucher" className="h-64 w-64 rounded-lg border border-[var(--card-border)] bg-white object-contain" />
                <div className="text-xs text-[var(--text-muted)]">
                  Apresente este QR Code na entrada para validação pelo administrador.
                </div>
              </>
            )}
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
