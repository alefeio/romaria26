import { describe, expect, it } from "vitest";
import { BRAZIL_TIMEZONE } from "@/lib/datetime-brazil";
import { formatCalendarDatePt, formatDateOnly, formatDateOnlyWithTime } from "@/lib/format";

describe("formatDateOnly / campos @db.Date", () => {
  const midnightUtc = new Date("2026-10-10T00:00:00.000Z");

  it("mantém o dia civil 10/10 quando a data vem como meia-noite UTC", () => {
    expect(formatDateOnly(midnightUtc)).toBe("10/10/2026");
    expect(formatDateOnly("2026-10-10")).toBe("10/10/2026");
    expect(formatDateOnly("2026-10-10T00:00:00.000Z")).toBe("10/10/2026");
  });

  it("não usa o fuso do Brasil (que recuaria para 09/10)", () => {
    const shifted = new Intl.DateTimeFormat("pt-BR", {
      timeZone: BRAZIL_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(midnightUtc);
    expect(shifted).toBe("09/10/2026");
    expect(formatCalendarDatePt(midnightUtc)).toBe("10/10/2026");
  });

  it("concatena o horário cadastrado sem alterar o dia", () => {
    expect(formatDateOnlyWithTime(midnightUtc, "06:57")).toBe("10/10/2026 às 06:57");
  });
});
