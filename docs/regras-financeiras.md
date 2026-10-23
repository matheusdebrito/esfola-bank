# Regras Financeiras

As regras de cálculo são **configuráveis manualmente na plataforma** através da entidade `FinancialPolicy` (endpoint `/api/v1/financial-policies`). Nenhum valor é hardcoded.

## Modelo de juros

- **Juros flat**: o total do empréstimo é `principal × (1 + interestRatePercent / 100)`.
  - Exemplo: R$ 100,00 com 30% → total R$ 130,00.
- O total é dividido pelo número de parcelas; a última parcela absorve a diferença de centavos.
- A **periodicidade** (mensal ou diária) é escolhida na criação do empréstimo, não na política:
  - `MONTHLY`: vencimentos a cada mês a partir do primeiro vencimento.
  - `DAILY`: vencimentos a cada dia a partir do primeiro vencimento.
- O empréstimo guarda um snapshot de `interestRatePercent` da política usada.

## Campos da política financeira

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| name | Nome da política | "Padrão 2026" |
| interestRatePercent | Juros flat (%) sobre o valor do empréstimo | 30,00 |
| lateFeeAmount | Multa fixa por parcela atrasada (R$) | 10,00 |
| dailyLateInterestPercent | Juros de mora diário (%) sobre o valor vencido | 0,33 |
| roundingMode | HALF_UP, HALF_EVEN, DOWN, UP | HALF_UP |
| toleranceDays | Dias de tolerância antes de considerar atraso | 0 |
| active | Política ativa | true |

## Cálculo de parcelas

- `totalCents = round(principal × (1 + taxa / 100) × 100)`.
- Parcelas 1..n-1 recebem `floor(totalCents / n)`; a última recebe o restante.
- Cada parcela é dividida em principal e juros (`interestDue = totalDue - principalDue`).
- **Arredondamento**: conforme `roundingMode` (padrão HALF_UP, 2 casas decimais).

## Encargos de atraso

Calculados por parcela vencida:
- Multa fixa de `lateFeeAmount` (ex.: R$ 10,00) por parcela.
- Juros de mora: `overdueAmount × (dailyLateInterestPercent / 100) × dias faturáveis`.
- Dias faturáveis = dias de atraso além de `toleranceDays`.
- A baixa manual pela lista de parcelas (`POST /installments/:id/pay`) cobra o saldo da parcela + encargos de atraso.
- O `totalDue` permanece como valor original da parcela. `updatedTotalDue` reflete esse
  original acrescido de encargos já pagos e dos encargos correntes; `updatedRemainingBalance`
  indica quanto falta pagar hoje (saldo contratual restante + encargos correntes).
- Os valores atualizados são calculados na consulta; não é necessário nem correto
  adicionar juros ao saldo contratual persistido a cada dia.

## Pagamentos e alocações

- Um pagamento pode ser alocado a múltiplas parcelas (`PaymentAllocation`).
- Soma das alocações deve igualar o valor recebido.
- Principal + juros alocados não podem exceder o saldo contratual da parcela; encargos de mora são cobrados à parte e não alteram o saldo.
- Pagamentos confirmados não são apagados; estornos são explícitos, auditados e revertem saldos das parcelas.

## Status de empréstimo e transições válidas

DRAFT → ACTIVE, CANCELED | ACTIVE → LIQUIDATED, RENEGOTIATED, CANCELED | LIQUIDATED, CANCELED, RENEGOTIATED → terminais.

Ao ativar um empréstimo FIXED_INSTALLMENTS sem parcelas, estas são geradas automaticamente conforme a política e a periodicidade.
