# Dashboard e Caixa — implementação do esboço visual

A interface reproduz a composição de referência: navegação navy, busca no topo, quatro indicadores em cartões pastel, gráfico financeiro combinado, rosca de situação dos empréstimos, listas operacionais e barra inferior com ação central no celular. A página separada **Caixa** inclui cartões de capital, movimentações, filtros, saldos após lançamentos e formulários de aporte/retirada.

## Regras de dados (sem valores inventados)

- **Caixa disponível**: saldo inicial conciliado + aportes + pagamentos confirmados - retiradas - despesas - desembolsos. Exclusivamente para perfis com `finance:read`.
- **Capital emprestado**: soma do principal dos contratos com status `ACTIVE`, não soma dos valores a receber nem o saldo de caixa.
- **Recebimentos do período**: valores efetivamente recebidos (`Payment` registrado), obedecendo ao seletor de período.
- **Em atraso**: parcelas vencidas, com encargos atualizados, retornadas pelo dashboard de cobrança.
- **Resumo financeiro**: últimos seis meses; entradas incluem pagamentos e aportes, saídas incluem despesas, retiradas e desembolsos; linha indica saldo acumulado desde abertura real. Não confundir com receita e lucro contábil.
- **Situação dos empréstimos**: apenas contratos `ACTIVE`, em grupos mutuamente exclusivos por prioridade: qualquer parcela vencida = em atraso; senão, qualquer parcela que vence em até sete dias = próximo vencimento; demais = em dia.
- **Caixa / Saldo após**: saldo efetivo recalculado sobre todos os movimentos válidos em ordem cronológica **antes** de filtrar e paginar o extrato. Movimentos estornados permanecem visíveis mas não alteram saldos. Saldos históricos são apresentados ajustados por estornos atuais.
- **Ações**: buscas levam a cadastros reais; sino indica vencimentos e atrasos; WhatsApp só é oferecido quando há telefone cadastrado; aporte e retirada usam API existente com auditoria e saldo suficiente.

## Permissões e limitações

- Quem não possui `finance:read` não recebe informações de caixa; `finance:write` é obrigatório para adicionar e retirar dinheiro.
- Caixa não inicializado apresenta orientação para abertura real; nunca simula capital.
- Pagamentos anteriores à abertura não são somados retroativamente, nem se inferem desembolsos históricos de contratos antigos.
- O capital emprestado refere-se ao principal de contratos ativos, não a capital em caixa.
- Não há alteração de schema ou migração Prisma.
- Interface adaptada a celulares (320–430px), tablets e desktops. As capturas automatizadas usam dados fictícios para inspecionar layout; validar também com dados reais após o deploy.

## Checklist antes de produção

1. Confirmar painel, quatro KPIs, gráfico combinado e classificação da rosca.
2. Abrir **Caixa** com ADMIN/MANAGER e conferir saldo com Financeiro e extratos reais.
3. Criar aporte e retirada com motivo. Confirmar atualização de saldo, extrato, usuário e novo gráfico.
4. Testar filtro por tipo e data: o saldo após movimento não deve mudar ao mudar o filtro.
5. Testar estorno, saldo insuficiente e perfis AUDITOR/OPERATOR.
6. Conferir WhatsApp apenas em clientes com telefone cadastrado.
7. Conferir menu mobile e formulários em 320/375px.
8. Verificar que `git pull --ff-only` e `docker compose up -d --build` não exigem migrações adicionais.
