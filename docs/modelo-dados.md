# Modelo de Dados e Relacionamentos

## Entidades principais

| Entidade | Descrição |
|----------|-----------|
| `User` | Usuário interno (ADMIN, MANAGER, OPERATOR, AUDITOR) |
| `RefreshToken` | Tokens de refresh (rotação e revogação) |
| `Client` | Cliente tomador de empréstimo (CPF único; telefone para contato/cobrança) |
| `ClientDocument` | Documento pessoal (RG, comprovante de residência) |
| `FinancialPolicy` | Política financeira configurável (juros flat, multa fixa, mora diária, tolerância) |
| `Loan` | Empréstimo (vinculado a cliente, usuário e política; periodicidade mensal/diária) |
| `Installment` | Parcela/obrigação do empréstimo |
| `Payment` | Recebimento lançado manualmente |
| `PaymentAllocation` | Alocação de um pagamento a parcelas |
| `AuditLog` | Trilha de auditoria (imutável para operadores) |
| `CacheInvalidationEvent` | Eventos de invalidação de cache (outbox) |

## Principais relacionamentos

- `Client 1:N Loan`, `Client :N ClientDocument`, `Client :N Payment`
- `User :N Loan`, `User :N Payment`, `User :N AuditLog`, `User :N RefreshToken`
- `FinancialPolicy 1:N Loan`
- `Loan 1:N Installment`, `Loan 1:N Payment`
- `Installment 1:N PaymentAllocation`
- `Payment 1:N PaymentAllocation`
- `ClientDocument N:1 Client`, `N:1 User` (uploader, opcional)

## Valores monetários

Todos os campos de valor usam `Decimal` no PostgreSQL (`@db.Decimal(14, 2)`), evitando ponto flutuante para cálculos financeiros.

## Índices

CPF único, e-mail único, idempotency key única, e índices em status, datas de vencimento, cliente, usuário e domínio de cache.
