# Livro-caixa — módulo Financeiro

## Abertura e reconciliação
1. Acessar **Financeiro** como ADMIN ou MANAGER, conferir saldo real de caixa/bancos e informar o saldo inicial.
2. A abertura é única e fixa o instante `startedAt` (data/hora do servidor). Não há backfill automático de desembolsos, gastos ou pagamentos históricos.
3. **Pagamentos** com `receivedAt >= startedAt` e status `REGISTERED` entram automaticamente no caixa. Estornos (`REVERSED`) deixam de compor o saldo, sem apagar o histórico.
4. **Contratos antigos** não podem receber novo desembolso pelo módulo, pois o dinheiro já entregue deve estar refletido no saldo inicial; isso evita débito em duplicidade.

## Lançamentos
- **Aporte**: entrada de capital próprio, aumenta o saldo, não é receita.
- **Retirada de sócio**: saída de caixa, não é despesa operacional nem lucro.
- **Despesa**: saída de caixa e dedução do resultado operacional de caixa.
- **Desembolso**: saída no valor total do principal de um contrato ativo criado após a abertura, sem pagamentos e sem desembolso anterior. É operação patrimonial, não despesa.
- **Recebimento**: vem de `Payment` já existente; não criar lançamento manual de recebimento.
- Lançamentos manuais são imutáveis; uma correção se faz por **estorno justificado** e, se necessário, registro de novo movimento. O usuário e a justificativa ficam no histórico de auditoria.
- Saídas são recusadas se excederem o saldo disponível apurado na transação. Pode haver saldo negativo após um estorno tardio de pagamento; nesse caso, é necessária conciliação.

## Fórmulas
```
Saldo disponível = saldo inicial + aportes + pagamentos registrados
                  - desembolsos - despesas - retiradas
Resultado operacional de caixa = juros contratuais recebidos
                                + encargos recebidos - despesas
```
Todas as parcelas monetárias são somadas em centavos após a conversão de `Decimal`. As consultas de recebimentos e respectivas alocações usam os registros originais, evitando dupla contagem.

## Limites
- O resultado **não é lucro líquido**, nem contabilidade por competência: faltam provisão de perdas, impostos não registrados, custos externos, rendimentos de caixa e eventual distribuição de resultados.
- O livro não é conta bancária sincronizada. O saldo deve ser conciliado com extratos reais.
- Não suporta múltiplas contas bancárias ou desembolso parcial. Desembolsos históricos e ajustes anteriores à abertura devem ser incorporados ao saldo inicial, não lançados depois.
- Usuários ADMIN/MANAGER podem registrar e estornar; AUDITOR tem consulta; OPERATOR não acessa dados financeiros de gestão.
- As migrações Prisma devem rodar **antes** de iniciar o backend novo, com backup do banco de dados.
- Não execute a configuração de abertura antes de conferir o saldo real; ela não é reversível pela interface.
