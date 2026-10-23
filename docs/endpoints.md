# Documentação dos Endpoints

Prefixo: `/api/v1`. Respostas em JSON. Erros centralizados com `{ error, message, statusCode, code }`.

## Autenticação

| Método | Endpoint | Descrição | Corpo |
|--------|----------|-----------|-------|
| POST | /auth/login | Login (seta cookies HttpOnly) | { email, password } |
| POST | /auth/logout | Logout (revoga refresh token) | - |
| POST | /auth/refresh | Renova sessão (rotação de refresh) | - |
| GET | /auth/me | Usuário autenticado (inclui `permissions` efetivas do papel) | - |

## Usuários

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /users | Listar usuários (paginado) | users:read |
| POST | /users | Criar usuário | users:create |
| GET | /users/:id | Obter usuário | users:read |
| PATCH | /users/:id | Atualizar usuário | users:update |
| PATCH | /users/:id/active | Ativar/desativar | users:status_change |
| POST | /users/:id/reset-password | Redefinir senha | users:create |
| POST | /users/me/password | Alterar própria senha | autenticado |

## Clientes

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /clients | Listar clientes (paginado, busca) | clients:read |
| POST | /clients | Criar cliente | clients:create |
| GET | /clients/:id | Obter cliente | clients:read |
| PATCH | /clients/:id | Atualizar cliente | clients:update |
| PATCH | /clients/:id/active | Ativar/desativar | clients:deactivate |
| DELETE | /clients/:id | Excluir cliente (somente sem histórico financeiro) | clients:delete |

## Documentos

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| POST | /clients/:clientId/documents | Upload de documento | documents:upload |
| GET | /clients/:clientId/documents | Listar documentos do cliente | documents:read |
| GET | /documents/:id/download | Download protegido | documents:download |
| DELETE | /documents/:id | Remover documento | documents:remove |

## Empréstimos

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /loans | Listar empréstimos (paginado, busca por código/cliente/CPF) | loans:read |
| POST | /loans | Criar empréstimo (status DRAFT, código EMP-ano-sequencial) | loans:create |
| GET | /loans/:id | Obter empréstimo (com parcelas e pagamentos) | loans:read |
| PATCH | /loans/:id | Atualizar empréstimo (apenas DRAFT) | loans:update |
| PATCH | /loans/:id/status | Mudar status (transições válidas) | loans:status_change |
| DELETE | /loans/:id | Excluir definitivamente (DRAFT/CANCELED sem histórico) | loans:delete |

Cada empréstimo recebe um `code` no formato `EMP-<ano>-<sequencial de 4 dígitos>`
(ex.: `EMP-2026-0001`), gerado de forma atômica e reiniciado a cada ano. O código é
pesquisável e aparece nas listagens de empréstimos, parcelas, inadimplência e pagamentos.

## Parcelas

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /installments | Listar parcelas (com atraso e encargos) | installments:read |
| GET | /installments/:id | Obter parcela | installments:read |
| POST | /installments/:id/pay | Baixar parcela como paga (saldo + multa/juros de atraso) | payments:register |

Filtros de `/installments`: `loanId`, `status`, `overdueOnly=true|false`, `page`, `pageSize`.
O atraso é **calculado** (vencimento anterior à data de hoje): `overdueOnly=true` e
`status=OVERDUE` retornam as parcelas `PENDING`/`PARTIALLY_PAID` vencidas. Cada item inclui
`status` (persistido), `effectiveStatus` (ex.: `OVERDUE`), `isOverdue` e `daysOverdue`.

Valores monetários retornados na listagem e no detalhe:
- `totalDue`: valor **original/contratual** da parcela, que não muda com o atraso;
- `updatedTotalDue`: valor original + encargos de atraso já pagos + encargos atuais a cobrar;
- `paidAmount`: valor recebido, incluindo eventuais encargos pagos;
- `remainingBalance`: saldo **contratual** restante (não inclui mora);
- `updatedRemainingBalance`: saldo contratual restante + multa e juros atuais;
- `lateCharges`: detalhamento dos encargos atuais, calculados na leitura.

Os totais atualizados são apenas valores de resposta: não sobrescrevem os campos
contratuais no banco de dados e variam conforme a data de consulta.

## Pagamentos

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| POST | /payments | Registrar pagamento (transacional, idempotente) | payments:register |
| GET | /payments | Listar pagamentos (paginado, com alocações por parcela) | payments:read |
| GET | /payments/:id | Obter pagamento (com alocações) | payments:read |
| POST | /payments/:id/reverse | Estornar pagamento | payments:reverse |

## Políticas financeiras

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /financial-policies | Listar políticas | users:read |
| POST | /financial-policies | Criar política | users:create |
| GET | /financial-policies/:id | Obter política | users:read |
| GET | /financial-policies/default | Obter política padrão | users:read |
| PATCH | /financial-policies/:id | Atualizar política | users:update |
| DELETE | /financial-policies/:id | Remover política | users:update |

## Dashboards

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /dashboards/executive | Indicadores executivos | dashboards:read |
| GET | /dashboards/financial | Recebimentos por dia | dashboards:read |
| GET | /dashboards/defaults | Inadimplência | dashboards:read |
| GET | /dashboards/operational | Atividade operacional | dashboards:read |
| GET | /dashboards/fiscalization | Eventos de fiscalização | dashboards:read |
| GET | /dashboards/monthly | Indicadores do mês corrente (fuso de Brasília) | dashboards:read |
| GET | /dashboards/overview | Dashboard consolidado (KPIs, gráficos, tabelas) | dashboards:read |
| GET | /dashboards/upcoming-due | Próximos vencimentos (paginado, busca) | dashboards:read |

`delinquencyRate` = valor vencido ÷ carteira em aberto (parcelas `PENDING`/`PARTIALLY_PAID`),
em percentual. O atraso usa a data-calendário de Brasília, então parcelas que vencem hoje
ainda não contam como atrasadas.

## Auditoria

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /audit | Log de auditoria (paginado) | audit:read |

## Infraestrutura

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /health | Health check do backend |
