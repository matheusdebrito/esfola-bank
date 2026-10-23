# Registro de Decisões Técnicas

## Arquitetura

- Monólito modular organizado por funcionalidades (não microsserviços), conforme requisito.
- Backend: Express + TypeScript + Prisma + PostgreSQL.
- Frontend: React + Vite + TypeScript + Tailwind + React Router + TanStack Query + React Hook Form + Zod + Recharts.
- Prefixo da API: `/api/v1`.
- Respostas coerentes com `{ error, message, statusCode, code }`.

## Autenticação

- JWT com expiração (access 15 min, refresh 7 dias), emissor e audiência validados.
- Tokens armazenados em cookies `HttpOnly`, `Secure` (configurável) e `SameSite`.
- Refresh token rotacionado e revogável; hash armazenado no banco.
- Senhas hasheadas com Argon2id (fallback scrypt em ambientes sem toolchain de build, ex. Windows).

## Valores monetários

- `Decimal` no PostgreSQL e tipos decimais no backend. Nunca ponto flutuante para cálculos financeiros.

## Regras financeiras

- Não hardcoded: configuráveis via entidade `FinancialPolicy` (juros flat, multa fixa, juros de mora diário, arredondamento, tolerância).
- Cálculo isolado em `calculation.service.ts`.

## Pagamentos

- Transação única do banco para pagamento + alocações + atualização de parcelas.
- Idempotência via `idempotencyKey`.
- Estornos explícitos e auditados (não apagar pagamentos confirmados).

## Cache

- Redis apenas para dashboards/relatórios, com TTL e invalidação via outbox (`CacheInvalidationEvent`) + worker idempotente.
- Nunca usado para integridade financeira ou autorização.

## Auditoria

- `AuditLog` registra operações sensíveis com usuário, ação, entidade, valores antigo/novo e IP.
- Protegida contra alteração/exclusão por operadores.

## Armazenamento de documentos

- Local em `storage/clients/<id>/` com nomes aleatórios, validação de MIME/magic bytes/tamanho, prevenção de path traversal.
- Isolado em `StorageService` para futura migração a objeto.

## Testes

- Vitest + Supertest. Banco de teste separado (não toca desenvolvimento/produção).
- Testes de unidade (CPF, JWT, senha, armazenamento) e integração (auth, usuários) que se conectam ao banco de teste quando disponível.

## Ambiente

- Docker Compose com volumes persistentes para postgres, redis e storage.
- Docker Desktop não disponível neste ambiente de desenvolvimento; validação de containers pendente.
