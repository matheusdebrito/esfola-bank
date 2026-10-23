# Matriz de Permissões

Perfis: ADMIN, MANAGER, OPERATOR, AUDITOR.

| Permissão | ADMIN | MANAGER | OPERATOR | AUDITOR |
|-----------|-------|---------|----------|---------|
| clients:read | ✓ | ✓ | ✓ | ✓ |
| clients:create | ✓ | ✓ | ✓ | |
| clients:update | ✓ | ✓ | ✓ | |
| clients:deactivate | ✓ | ✓ | | |
| clients:delete | ✓ | ✓ | | |
| documents:read | ✓ | ✓ | ✓ | ✓ |
| documents:upload | ✓ | ✓ | ✓ | ✓ |
| documents:download | ✓ | ✓ | ✓ | ✓ |
| documents:remove | ✓ | | | |
| loans:read | ✓ | ✓ | ✓ | ✓ |
| loans:create | ✓ | ✓ | ✓ | |
| loans:update | ✓ | ✓ | | |
| loans:status_change | ✓ | ✓ | | |
| loans:delete | ✓ | | | |
| installments:read | ✓ | ✓ | ✓ | ✓ |
| payments:read | ✓ | ✓ | ✓ | ✓ |
| payments:register | ✓ | ✓ | ✓ | |
| payments:reverse | ✓ | | | |
| users:read | ✓ | ✓ | ✓ | ✓ |
| users:create | ✓ | | | |
| users:update | ✓ | ✓ | | |
| users:status_change | ✓ | | | |
| audit:read | ✓ | ✓ | | ✓ |
| dashboards:read | ✓ | ✓ | ✓ | ✓ |
| reports:export | ✓ | ✓ | | ✓ |

## Regras de negócio de acesso

- Esconder botão no frontend não é autorização; todas as rotas protegidas validam permissão no backend.
- Auditor tem leitura, sem poder modificar registros financeiros auditados.
- Operador não pode desativar clientes nem reverter pagamentos.
- Exclusão definitiva de empréstimo é restrita ao ADMIN e só é permitida para empréstimos
  `DRAFT` ou `CANCELED`, sem parcelas e sem pagamentos (caso contrário a API responde
  `409 LOAN_HAS_FINANCIAL_HISTORY`).
- A trilha de auditoria é protegida contra alteração/exclusão por usuários comuns.
