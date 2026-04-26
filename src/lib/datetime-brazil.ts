/**
 * Datas/horas no fuso de Brasília (BRT, UTC−3, sem horário de verão desde 2019).
 * Use em Server Components e APIs Node onde o padrão costuma ser UTC.
 */
export const BRAZIL_TIMEZONE = "America/Sao_Paulo" as const;

/** Hoje (AAAA-MM-DD) segundo o calendário de Brasília. */
export function ymdTodayBrazil(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: BRAZIL_TIMEZONE });
}

/** Soma dias civis a partir de AAAA-MM-DD; o resultado continua no calendário local BR ao formatar. */
export function addCalendarDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((v) => parseInt(v, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const t = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return t.toLocaleDateString("en-CA", { timeZone: BRAZIL_TIMEZONE });
}

export function formatDateTimeBr(d: Date | string, opts?: { withSeconds?: boolean }): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(opts?.withSeconds ? { second: "2-digit" as const } : {}),
  });
}

/** Título com dia da semana (ex.: lista do caixa no painel). */
export function labelDayLongPtYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return ymd;
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return t.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
