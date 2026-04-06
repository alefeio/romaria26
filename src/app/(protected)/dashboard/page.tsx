import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { getRomariaAdminDashboard } from "@/lib/romaria-dashboard-data";

function formatBrl(value: string): string {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const user = await requireSessionUser();

  if (user.role === "CUSTOMER") {
    redirect("/cliente/dashboard");
  }

  if (user.role !== "ADMIN" && user.role !== "MASTER") {
    redirect("/login");
  }

  let data: Awaited<ReturnType<typeof getRomariaAdminDashboard>>;
  try {
    data = await getRomariaAdminDashboard();
  } catch {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">Não foi possível carregar o painel</h2>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Verifique a conexão com o banco de dados.</p>
      </div>
    );
  }

  const statusPt: Record<string, string> = {
    PENDING: "Pendente",
    CONFIRMED: "Confirmada",
    CANCELLED: "Cancelada",
  };

  return (
    <div className="py-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Painel</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Olá, {user.name}. Resumo de pacotes e reservas.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/pacotes"
          className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition hover:border-[var(--igh-primary)]"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Pacotes abertos</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{data.packagesOpen}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">de {data.packagesTotal} cadastrados</p>
        </Link>
        <Link
          href="/admin/reservas"
          className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition hover:border-[var(--igh-primary)]"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Reservas pendentes</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700 dark:text-amber-300">{data.reservationsPending}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">aguardando confirmação</p>
        </Link>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Reservas (total)</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{data.reservationsTotal}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">histórico completo</p>
        </div>
      </div>

      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/admin/pacotes" className="text-[var(--igh-primary)] hover:underline">
          Pacotes
        </Link>
        <Link href="/admin/reservas" className="text-[var(--igh-primary)] hover:underline">
          Reservas
        </Link>
        <Link href="/admin/email" className="text-[var(--igh-primary)] hover:underline">
          E-mail
        </Link>
        <Link href="/admin/sms" className="text-[var(--igh-primary)] hover:underline">
          SMS
        </Link>
        <Link href="/admin/site/configuracoes" className="text-[var(--igh-primary)] hover:underline">
          Site
        </Link>
      </p>

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Últimas reservas</h2>
          <Link href="/admin/reservas" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--igh-surface)] text-left">
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Pacote</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Conta</th>
                <th className="px-3 py-2 font-medium">Qtd</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentReservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[var(--text-muted)]">
                    Nenhuma reserva ainda.
                  </td>
                </tr>
              ) : (
                data.recentReservations.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--card-border)]">
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--text-muted)]">
                      {r.reservedAt.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/passeios/${r.package.slug}`} className="text-[var(--igh-primary)] hover:underline">
                        {r.package.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.customerNameSnapshot}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-xs text-[var(--text-muted)]">{r.user.email}</td>
                    <td className="px-3 py-2">{r.quantity}</td>
                    <td className="px-3 py-2">{formatBrl(r.totalPrice)}</td>
                    <td className="px-3 py-2">{statusPt[r.status] ?? r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
