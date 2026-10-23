# Dicionário de Métricas dos Dashboards

Todas as métricas são consultas reais ao PostgreSQL (fonte oficial). O Redis apenas acelera com TTL.

## Dashboard executivo (`/api/v1/dashboards/executive`)

| Métrica | Definição | Consulta base |
|---------|-----------|---------------|
| Principal concedido | Soma de `principalAmount` dos empréstimos (filtro período opcional) | `SUM(Loan.principalAmount)` |
| Empréstimos ativos | Contagem de empréstimos com status ACTIVE | `COUNT(*) WHERE status='ACTIVE'` |
| Clientes ativos | Contagem de clientes com active=true | `COUNT(*) WHERE active=true` |
| Valor vencido | Soma de saldo contratual restante + multa e juros atuais das parcelas abertas vencidas | Cálculo por parcela conforme política financeira |
| Recebido total | Soma de `receivedAmount` de pagamentos REGISTERED no período | `SUM(Payment.receivedAmount)` |
| Juros recebidos | Soma de `interestAmount` das alocações de pagamentos registrados | `SUM(PaymentAllocation.interestAmount)` |
| Parcelas vencidas | Contagem de parcelas vencidas não quitadas | `COUNT(*) WHERE status IN ('PENDING','PARTIALLY_PAID') AND dueDate < NOW()` |
| Taxa de inadimplência | (valor vencido atualizado / carteira em aberto com encargos) × 100 | fórmula explícita |

## Dashboard financeiro (`/api/v1/dashboards/financial`)

| Métrica | Definição |
|---------|-----------|
| Recebimentos por dia | Agrupamento de `Payment.receivedAmount` por `DATE(receivedAt)` no período |

## Dashboard de inadimplência (`/api/v1/dashboards/defaults`)

| Métrica | Definição |
|---------|-----------|
| Parcelas vencidas | Parcelas com `dueDate < hoje` e status PENDING/PARTIALLY_PAID |
| Valor vencido | Soma do saldo em aberto atualizado dessas parcelas |
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

## Dashboard geral (`/api/v1/dashboards/overview`)

- Valor vencido, tabela de parcelas em atraso, aging e clientes inadimplentes usam o cálculo de encargos da política financeira.
- Carteira em aberto soma saldo contratual e encargos correntes vencidos, mantendo a taxa de inadimplência consistente.
- Os campos persistidos de parcelas não são alterados. Os cálculos respeitam o calendário de Brasília e os dias de tolerância.

## Revisão de consistência (outubro de 2026)

- **Posição atual**: carteira em aberto, parcelas vencidas e percentual de carteira vencida são apurados sobre a carteira presente; esses indicadores não mudam quando o usuário filtra datas históricas de movimentação.
- **Movimentação no período**: recebimentos e capital de empréstimos não cancelados/draft seguem o intervalo selecionado. `grantedAt` atualmente é registrado quando o contrato é criado; portanto não deve ser interpretado como comprovante de desembolso real.
- **A receber no período**: soma saldos contratuais ainda abertos com vencimento no intervalo, não o total original da parcela e não encargos de mora.
- **Gráficos de fluxo**: agrupam por dia para períodos de até 32 dias e por mês nos períodos mais longos; vencimento é tratado como data-calendário UTC e recebimento por data/hora de Brasília.
- **Status de parcelas**: grupos mutuamente exclusivos; um pagamento parcial atrasado pertence à categoria vencida.
- **Recebimentos discriminados**: `receivedPrincipal`, `receivedInterest` e `receivedCharges` provêm de `PaymentAllocation` vinculada a `Payment.status=REGISTERED` no período; não equivalem a lucro líquido.
- **Juros da política em uso**: taxas, multa, arredondamento e tolerância não podem mais ser editados em política com contrato vinculado. Criar nova política preserva condições de empréstimos antigos.
- **Cancelamento/renegociação**: operações com pagamentos registrados ou saldo aberto exigem regularização prévia, em vez de omitir silenciosamente dívida da carteira.

### Limites ainda conhecidos

- O sistema não registra uma data distinta para liberação efetiva do principal; `grantedAt` não substitui um lançamento de desembolso financeiro.
- A métrica atual de carteira vencida é valor vencido sobre saldo total devido, **não** o indicador PAR30 de microfinanças.
- Não é possível calcular lucro líquido ou eficiência histórica de cobrança sem dados e regras adicionais de custos, perdas e fotografia dos vencimentos por período.
- Se houver contrato antigo já cancelado mantendo parcelas pendentes, sua correção requer conciliação dos registros existentes; a mudança preventiva não corrige retroativamente esses dados.
