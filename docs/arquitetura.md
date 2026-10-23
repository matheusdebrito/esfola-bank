# Diagrama de Arquitetura

## Visão geral

O sistema é um monólito modular organizado em camadas, executado via Docker Compose com quatro serviços principais:

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Frontend   │◄────►│   Backend   │◄────►│  PostgreSQL  │
│  (React)    │  HTTP│  (Express)  │  SQL │   (16)       │
│ porta 5173  │      │ porta 4000  │      └──────────────┘
└─────────────┘      └──────┬──────┘           ▲
                           │                    │
                 ┌─────────▼─────────┐          │
                 │      Redis        │          │
                 │   (cache, 7)      │          │
                 │ porta 6379        │          │
                 └───────────────────┘          │
                           ▲                    │
                           │                    │
                    ┌──────┴──────┐              │
                    │  storage/   │─────────────┘
                    │ documentos  │ (volume)
                    └─────────────┘
```

## Camadas do backend

- `src/config/` — env, logger, Prisma, Redis
- `src/middlewares/` — erro, logger de requisição, autenticação JWT, permissões
- `src/modules/<feature>/` — rotas, controllers, services, schemas (Zod)
- `src/shared/` — cache, storage (arquivos locais), erros
- `src/app.ts` / `src/server.ts` — montagem da app e servidor

## Comunicação

- Frontend ↔ Backend: HTTP REST com cookies HttpOnly (JWT) + CORS restrito
- Backend ↔ PostgreSQL: Prisma ORM (transações, consultas agregadas)
- Backend ↔ Redis: cache seletivo (dashboards/relatórios), nunca fonte oficial
- Backend ↔ storage/: upload/download de documentos (volume persistente)

## Persistência

- PostgreSQL: volumes nomeados `emprestimo_postgres_data`
- Redis: volumes nomeados `emprestimo_redis_data` (append-only)
- Documentos: volume `emprestimo_storage` montado em `/storage/clients`
