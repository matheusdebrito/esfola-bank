# Dicionário de Métricas dos Dashboards

Todas as métricas são consultas reais ao PostgreSQL (fonte oficial). O Redis apenas acelera com TTL.

## Dashboard executivo (`/api/v1/dashboards/executive`)

| Métrica | Definição | Consulta base |
|---------|-----------|---------------|
| Principal concedido | Soma de `principalAmount` dos empréstimos (filtro período opcional) | `SUM(Loan.principalAmount)` |
| Empréstimos ativos | Contagem de empréstimos com status ACTIVE | `COUNT(*) WHERE status='ACTIVE'` |
| Clientes ativos | Contagem de clientes com active=true | `COUNT(*) WHERE active=true` |
| Valor vencido | Soma de `remainingBalance` de parcelas vencidas (status PENDING/PARTIALLY_PAID e dueDate < hoje) | `SUM(Installment.remainingBalance)` |
| Recebido total | Soma de `receivedAmount` de pagamentos REGISTERED no período | `SUM(Payment.receivedAmount)` |
| Juros recebidos | Soma de `interestAmount` das alocações de pagamentos registrados | `SUM(PaymentAllocation.interestAmount)` |
| Parcelas vencidas | Contagem de parcelas vencidas não quitadas | `COUNT(*) WHERE status IN ('PENDING','PARTIALLY_PAID') AND dueDate < NOW()` |
| Taxa de inadimplência | (valor vencido / total recebido) × 100 | fórmula explícita |

## Dashboard financeiro (`/api/v1/dashboards/financial`)

| Métrica | Definição |
|---------|-----------|
| Recebimentos por dia | Agrupamento de `Payment.receivedAmount` por `DATE(receivedAt)` no período |

## Dashboard de inadimplência (`/api/v1/dashboards/defaults`)

| Métrica | Definição |
|---------|-----------|
| Parcelas vencidas | Parcelas com `dueDate < hoje` e status PENDING/PARTIALLY_PAID |
| Valor vencido | Soma de `remainingBalance` dessas parcelas |
| Clientes inadimplentes | Clientes distintos com pelo menos uma parcela vencida |
| Lista detalhada | Cliente, parcela, vencimento, devido, saldo, dias de atraso, encargos de mora |

## Dashboard operacional (`/api/v1/dashboards/operational`)

| Métrica | Definição |
|---------|-----------|
| Empréstimos criados | Contagem de empréstimos por período (grantedAt/createdAt) |
| Pagamentos lançados | Contagem de pagamentos REGISTERED por período |
| Atividade por usuário | Agrupamento de empréstimos por usuário responsável |

## Dashboard de fiscalização (`/api/v1/dashboards/fiscalization`)

| Métrica | Definição |
|---------|-----------|
| Mudanças de status | Eventos de auditoria `LOAN_STATUS_CHANGE` |
| Estornos | Pagamentos com status `REVERSED` |

## Consistência

Dashboards aceitam consistência eventual (cache com TTL de 60s). Para leitura imediatamente consistente após uma operação, consultar o PostgreSQL diretamente.
