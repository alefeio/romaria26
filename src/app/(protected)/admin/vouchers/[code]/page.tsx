import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/email";
import { AdminSendVoucherButton } from "./send-voucher-button";

type Props = { params: Promise<{ code: string }> };

export default async function AdminVoucherDetailPage({ params }: Props) {
  await requireRole(["ADMIN", "MASTER"]);
  const { code } = await params;
  const c = decodeURIComponent(code ?? "").trim();
  if (!c) notFound();

  const v = await prisma.reservationVoucher.findFirst({
    where: { code: c },
    include: {
      reservation: {
        select: {
          id: true,
          customerNameSnapshot: true,
          customerEmailSnapshot: true,
          paymentStatus: true,
          package: { select: { name: true, slug: true, departureDate: true, departureTime: true, boardingLocation: true } },
        },
      },
    },
  });
  if (!v) notFound();

  const base = await resolvePublicAppUrl();
  const checkinUrl = `${base}/voucher/${encodeURIComponent(v.code)}`;
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, { margin: 1, scale: 8 });
  const label = v.personType === "ADULT" ? `Adulto #${v.personIndex + 1}` : `Criança #${v.personIndex + 1}`;

  return (
    <div className="py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/reservas/${v.reservationId}`} className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Voltar para reserva
        </Link>
        <AdminSendVoucherButton code={v.code} />
      </div>

      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Voucher (admin)</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Passeio: <span className="font-medium">{v.reservation.package.name}</span> · Cliente:{" "}
        <span className="font-medium">{v.reservation.customerNameSnapshot}</span> ({v.reservation.customerEmailSnapshot})
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">QR Code (check-in)</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR Code do check-in" className="mt-3 h-64 w-64 rounded-lg border border-[var(--card-border)] bg-white object-contain" />
          <div className="mt-3 text-xs text-[var(--text-muted)] break-all">{checkinUrl}</div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
          <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{v.name}</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            Nº <span className="font-mono font-semibold">{v.code}</span> · Camisa {v.shirtSize} · Kit café{" "}
            {v.personType === "ADULT" ? (v.hasBreakfastKit ? "Sim" : "Não") : "—"}
            {v.personType === "CHILD" && v.age ? ` · Idade ${v.age}` : ""}
          </div>

          <div className="mt-4 text-sm text-[var(--text-secondary)]">
            Status de uso: <span className="font-medium">{v.usedAt ? "Usado" : "Não usado"}</span>
          </div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            Pagamento da reserva: <span className="font-medium">{v.reservation.paymentStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

