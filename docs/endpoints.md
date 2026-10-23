# Documentação dos Endpoints

Prefixo: `/api/v1`. Respostas em JSON. Erros centralizados com `{ error, message, statusCode, code }`.

## Autenticação

| Método | Endpoint | Descrição | Corpo |
|--------|----------|-----------|-------|
| POST | /auth/login | Login (seta cookies HttpOnly) | { email, password } |
| POST | /auth/logout | Logout (revoga refresh token) | - |
| POST | /auth/refresh | Renova sessão (rotação de refresh) | - |
| GET | /auth/me | Usuário autenticado | - |

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
| GET | /loans | Listar empréstimos (paginado) | loans:read |
| POST | /loans | Criar empréstimo (status DRAFT) | loans:create |
| GET | /loans/:id | Obter empréstimo (com parcelas e pagamentos) | loans:read |
| PATCH | /loans/:id | Atualizar empréstimo (apenas DRAFT) | loans:update |
| PATCH | /loans/:id/status | Mudar status (transições válidas) | loans:status_change |

## Parcelas

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /installments | Listar parcelas (com atraso e encargos) | installments:read |
| GET | /installments/:id | Obter parcela | installments:read |
| POST | /installments/:id/pay | Baixar parcela como paga (saldo + multa/juros de atraso) | payments:register |

## Pagamentos

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| POST | /payments | Registrar pagamento (transacional, idempotente) | payments:register |
| GET | /payments | Listar pagamentos (paginado) | payments:read |
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

## Auditoria

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | /audit | Log de auditoria (paginado) | audit:read |

## Infraestrutura

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /health | Health check do backend |
