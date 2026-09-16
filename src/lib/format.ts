/**
 * Formata data/hora de forma determinística (sem locale) para evitar
 * diferença entre servidor e cliente (hydration mismatch).
 */
export function formatDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function toCalendarUtcDate(isoOrDate: string | Date): Date | null {
  if (typeof isoOrDate === "string") {
    const datePart = isoOrDate.trim().split("T")[0];
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [y, m, d] = datePart.split("-").map(Number);
      if (!y || !m || !d) return null;
      return new Date(Date.UTC(y, m - 1, d));
    }
    const parsed = new Date(isoOrDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!(isoOrDate instanceof Date) || Number.isNaN(isoOrDate.getTime())) return null;
  return isoOrDate;
}

/**
 * Data civil (campo só-dia / @db.Date) em pt-BR, sem recuar um dia no fuso do Brasil.
 * Prisma devolve essas datas como meia-noite UTC; formatar em America/Sao_Paulo
 * transformaria 10/10 em 09/10.
 */
export function formatCalendarDatePt(
  isoOrDate: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (isoOrDate == null) return "";
  const date = toCalendarUtcDate(isoOrDate);
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(date);
}

/**
 * Formata apenas a data (dd/mm/yyyy) sem deslocamento de fuso.
 * Use para datas “só dia” (ex.: startDate, sessionDate, birthDate, departureDate) que vêm em UTC ou como YYYY-MM-DD.
 */
export function formatDateOnly(isoOrDate: string | Date | null | undefined): string {
  return formatCalendarDatePt(isoOrDate);
}

/** Ex.: 10/10/2026 às 06:57 — data civil + horário cadastrado (não converter o horário). */
export function formatDateOnlyWithTime(
  date: string | Date | null | undefined,
  time: string | null | undefined
): string {
  const d = formatDateOnly(date);
  const t = String(time ?? "").trim();
  if (!d) return t;
  return t ? `${d} às ${t}` : d;
}
