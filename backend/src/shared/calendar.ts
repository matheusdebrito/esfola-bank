/**
 * Utilitários de data-calendário.
 *
 * Vencimentos e concessões são gravados como meia-noite UTC (data sem hora).
 * Comparar com `NOW()` marcaria o vencimento de hoje como atrasado durante o
 * dia; por isso as comparações usam a data-calendário no fuso de Brasília.
 */
export const APP_TIME_ZONE = "America/Sao_Paulo";

const calendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data-calendário de hoje no fuso de Brasília (YYYY-MM-DD). */
export function todayCalendarDate(): string {
  return calendarFormatter.format(new Date());
}

/** Converte uma data-calendário (YYYY-MM-DD) para meia-noite UTC. */
export function calendarDateToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Extrai a data-calendário (YYYY-MM-DD) de um Date gravado em meia-noite UTC. */
export function toCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas-calendário (positiva se `to` > `from`). */
export function daysBetweenCalendarDates(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return 0;
  return Math.floor((toMs - fromMs) / 86_400_000);
}
