import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calendarDateToUtc,
  daysBetweenCalendarDates,
  toCalendarDate,
  todayCalendarDate,
} from "./calendar";

describe("calendar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve calcular a data-calendário no fuso de Brasília", () => {
    vi.useFakeTimers();
    // 23/10 02:30 UTC = 22/10 23:30 em Brasília
    vi.setSystemTime(new Date("2026-10-23T02:30:00.000Z"));

    expect(todayCalendarDate()).toBe("2026-10-22");
  });

  it("deve converter data-calendário para meia-noite UTC", () => {
    expect(calendarDateToUtc("2026-10-23").toISOString()).toBe("2026-10-23T00:00:00.000Z");
  });

  it("deve extrair a data-calendário de um Date em meia-noite UTC", () => {
    expect(toCalendarDate(new Date("2026-10-23T00:00:00.000Z"))).toBe("2026-10-23");
  });

  it("deve calcular a diferença em dias entre datas-calendário", () => {
    expect(daysBetweenCalendarDates("2026-10-18", "2026-10-23")).toBe(5);
    expect(daysBetweenCalendarDates("2026-10-23", "2026-10-23")).toBe(0);
    expect(daysBetweenCalendarDates("2026-10-23", "2026-10-18")).toBe(-5);
  });

  it("deve retornar zero para datas inválidas", () => {
    expect(daysBetweenCalendarDates("data-invalida", "2026-10-23")).toBe(0);
  });
});
