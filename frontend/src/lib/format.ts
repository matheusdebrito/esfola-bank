/** Fuso horário de referência para exibição de datas e horários. */
export const APP_TIME_ZONE = "America/Sao_Paulo";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formata valores monetários em BRL. */
export function brl(value: number | string | null | undefined): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (numeric === null || numeric === undefined || !Number.isFinite(Number(numeric))) {
    return "R$ 0,00";
  }
  return Number(numeric).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Formata datas "de calendário" (vencimento, concessão).
 *
 * Essas datas são gravadas como meia-noite UTC; por isso a leitura usa UTC
 * para não deslocar o dia em fusos negativos.
 */
export function dateBr(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Formata data e hora no fuso de Brasília (ex.: recebimento, registro). */
export function dateTimeBr(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleString("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata percentuais com casas decimais configuráveis. */
export function percent(value: number | string | null | undefined, digits = 2): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (numeric === null || numeric === undefined || !Number.isFinite(Number(numeric))) {
    return "0%";
  }
  return `${Number(numeric).toFixed(digits).replace(".", ",")}%`;
}

/** Valor no formato aceito por `<input type="date">` (YYYY-MM-DD). */
export function toDateInputValue(value: DateInput = new Date()): string {
  const date = toDate(value) ?? new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Valor no formato aceito por `<input type="datetime-local">`. */
export function toDateTimeInputValue(value: DateInput = new Date()): string {
  const date = toDate(value) ?? new Date();
  return `${toDateInputValue(date)}T${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}
