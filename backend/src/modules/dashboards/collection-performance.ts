/**
 * Porcentagem das obrigações contratuais com vencimento no período já cumpridas.
 * Não usa o total de pagamentos avulsos do período como numerador: recebimentos
 * de outras safras (inclusive antecipações) não seriam comparáveis.
 */
export function collectionPerformance(scheduled: number, settled: number) {
  const scheduledCents = Math.max(0, Math.round(scheduled * 100));
  const settledCents = Math.max(0, Math.round(settled * 100));
  if (scheduledCents === 0) return { scheduled: 0, settled: 0, rate: null };
  const effectiveCents = Math.min(scheduledCents, settledCents);
  return {
    scheduled: scheduledCents / 100,
    settled: effectiveCents / 100,
    rate: Math.round((effectiveCents / scheduledCents) * 10000) / 100,
  };
}
