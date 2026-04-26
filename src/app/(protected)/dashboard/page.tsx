import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { formatDateTimeBr } from "@/lib/datetime-brazil";
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
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Olá, {user.name}. Resumo operacional, caixa e reservas.</p>

      <section className="mt-8" aria-labelledby="caixa-titulo">
        <h2 id="caixa-titulo" className="text-lg font-semibold text-[var(--text-primary)]">
          Caixa — pagamentos previstos (parcelas)
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">
          Soma e quantidade de parcelas com status <span className="font-medium">Agendada</span> por data de vencimento. Não
          inclui pagamentos avulsos sem parcela vinculada.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--igh-primary)]/40 bg-gradient-to-br from-[var(--igh-surface)] to-[var(--card-bg)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--igh-primary)]">Vencem hoje</p>
            <p className="mt-0.5 text-sm capitalize text-[var(--text-secondary)]">{data.expectedPaymentLabels.todayLabel}</p>
            <p className="mt-3 text-4xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatBrl(data.expectedPayments.today.totalBrl)}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {data.expectedPayments.today.count} parcela(s)
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Vencem amanhã</p>
            <p className="mt-0.5 text-sm capitalize text-[var(--text-secondary)]">
              {data.expectedPaymentLabels.tomorrowLabel}
            </p>
            <p className="mt-3 text-4xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatBrl(data.expectedPayments.tomorrow.totalBrl)}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {data.expectedPayments.tomorrow.count} parcela(s)
            </p>
          </div>
          <Link
            href="/admin/faturamento#parcelas-atraso"
            className="rounded-2xl border-2 border-red-200 bg-red-50/80 p-5 shadow-sm transition hover:border-red-400 dark:border-red-800/60 dark:bg-red-950/25 dark:hover:border-red-600"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">Em atraso</p>
            <p className="mt-0.5 text-sm text-red-800/80 dark:text-red-200/90">Vencimento antes de hoje, ainda pendentes</p>
            <p className="mt-3 text-4xl font-bold tabular-nums text-red-900 dark:text-red-100">
              {formatBrl(data.expectedPayments.overdue.totalBrl)}
            </p>
            <p className="mt-1 text-sm text-red-800/90 dark:text-red-200/90">
              {data.expectedPayments.overdue.count} parcela(s) · ver faturamento
            </p>
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {(
            [
              { key: "hoje" as const, short: "Vencem hoje", bucket: data.expectedPayments.today },
              { key: "amanha" as const, short: "Vencem amanhã", bucket: data.expectedPayments.tomorrow },
              { key: "atraso" as const, short: "A cobrar com urgência", bucket: data.expectedPayments.overdue },
            ] as const
          ).map(({ key, short, bucket }) => (
            <div key={key} className="flex min-h-0 flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
              <div className="border-b border-[var(--card-border)] px-3 py-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">{short}</p>
                <p className="text-xs text-[var(--text-muted)]">Até 8 itens</p>
              </div>
              <ul className="max-h-72 flex-1 divide-y divide-[var(--card-border)] overflow-y-auto text-sm">
                {bucket.items.length === 0 ? (
                  <li className="px-3 py-6 text-center text-[var(--text-muted)]">Nada nesta coluna.</li>
                ) : (
                  bucket.items.map((i) => (
                    <li key={i.id} className="flex items-start justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--text-primary)]">{i.customerName}</div>
                        <div className="truncate text-xs text-[var(--text-muted)]">{i.packageName}</div>
                        <div className="text-xs text-[var(--text-muted)]">Venc. {i.dueDate}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-medium tabular-nums">{formatBrl(i.amount)}</div>
                        <Link
                          href={`/admin/reservas/${i.reservationId}/pagamentos`}
                          className="text-xs font-medium text-[var(--igh-primary)] hover:underline"
                        >
                          Pagamentos
                        </Link>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

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
        <Link
          href="/admin/reservas"
          className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition hover:border-[var(--igh-primary)]"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Reservas no total</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{data.reservationsTotal}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">incluindo confirmadas e canceladas</p>
        </Link>
        <Link
          href="/admin/vouchers/scan"
          className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm transition hover:border-[var(--igh-primary)]"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Check-in</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Validar voucher</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Abrir câmera para ler QR Code</p>
        </Link>
      </div>

      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/admin/pacotes" className="text-[var(--igh-primary)] hover:underline">
          Pacotes
        </Link>
        <Link href="/admin/reservas" className="text-[var(--igh-primary)] hover:underline">
          Reservas
        </Link>
        <Link href="/admin/faturamento" className="text-[var(--igh-primary)] hover:underline">
          Faturamento
        </Link>
        <Link href="/admin/clientes" className="text-[var(--igh-primary)] hover:underline">
          Clientes
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
        <Link href="/admin/vouchers/scan" className="text-[var(--igh-primary)] hover:underline">
          Validar voucher
        </Link>
      </p>

      <section className="mt-10 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/40 p-5" aria-labelledby="sugestoes-titulo">
        <h2 id="sugestoes-titulo" className="text-base font-semibold text-[var(--text-primary)]">
          Outras informações úteis no painel
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Além do que já existe (pacotes, reservas, caixa), métricas abaixo costumam dar visão rápida da operação:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
          <li>
            <span className="font-medium text-[var(--text-primary)]">Ocupação e próximas saídas</span> — lugares restantes
            por pacote e data de embarque, para decidir fechamento ou campanha.
          </li>
          <li>
            <span className="font-medium text-[var(--text-primary)]">Conversão / funil</span> — visitantes, cadastros e
            reservas concluídas (se tiver analytics), para ver gargalos.
          </li>
          <li>
            <span className="font-medium text-[var(--text-primary)]">Recebido no período</span> — soma de pagamentos
            registrados no mês (comparar com mês anterior) alinhado a metas.
          </li>
          <li>
            <span className="font-medium text-[var(--text-primary)]">Reservas a confirmar</span> — já no painel; um lembrete
            diário reduz fila.
          </li>
          <li>
            <span className="font-medium text-[var(--text-primary)]">Inadimplência agregada</span> — total em aberto por
            reserva (além de parcelas) e “top” clientes com pendência.
          </li>
          <li>
            <span className="font-medium text-[var(--text-primary)]">Comunicação</span> — últimas campanhas SMS/e-mail
            e taxa de entrega, se passarem a ser rastreadas.
          </li>
        </ul>
      </section>

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
                      {formatDateTimeBr(r.reservedAt)}
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
