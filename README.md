# Sistema de Gestão de Empréstimos

Plataforma interna para gerenciamento de empréstimos pessoais, clientes, documentos, pagamentos, inadimplência, auditoria e dashboards gerenciais.

## Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, Recharts
- **Backend**: Node.js, TypeScript, Express, PostgreSQL, Prisma ORM, Zod, JWT, Argon2id, Redis, Vitest, Supertest
- **Infra**: Docker, Docker Compose, PostgreSQL, Redis, volumes persistentes

## Estrutura

```
frontend/         # aplicação React
backend/          # API Express + Prisma
storage/          # documentos enviados (volume persistente)
docs/             # documentação técnica
docker-compose.yml
.env.example
.gitignore
README.md
```

## Comandos

### 1. Copiar variáveis de ambiente
```bash
cp .env.example .env
# Ajuste os segredos no .env (nunca commitar valores reais)
```

### 2. Subir ambiente
```bash
docker compose up -d
```

### 3. Migrations
```bash
docker compose exec backend npx prisma generate
docker compose exec backend npx prisma migrate deploy
```

O histórico de migrations fica em `backend/prisma/migrations/` (baseline `0001_init`).

> **Banco criado antes da pasta `migrations`:** marque o baseline como aplicado uma única vez,
> sem recriar as tabelas:
> ```bash
> docker compose exec backend npx prisma migrate resolve --applied 0001_init
> docker compose exec backend npx prisma migrate status
> ```
> Em bancos novos, o `migrate deploy` já cria toda a estrutura.

### 4. Backend (local)
```bash
cd backend
npm install
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run lint        # eslint src
npm run build       # tsc
npm run dev         # tsx watch src/server.ts
```

### 5. Frontend (local)
```bash
cd frontend
npm install
npm run build       # tsc + vite build
npm run dev         # vite
```

### 6. Testes
```bash
docker compose exec backend npx vitest run
```

### 7. Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### 8. Parar
```bash
docker compose down
```

## Primeiro acesso

- URL: `http://localhost:5173`
- O backend cria automaticamente um administrador **somente quando não existe nenhum usuário** no banco, usando `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`.
- Padrão de desenvolvimento: `admin@emprestimo.local` / `Admin@12345`
- Altere a senha após o primeiro login e defina `ADMIN_PASSWORD` forte em produção.

## Fluxo básico de uso

1. **Políticas** → Nova política (juros flat, multa fixa, juros diário; marque "Definir como padrão").
2. **Clientes** → Novo cliente (CPF válido e telefone para cobrança via WhatsApp).
3. **Empréstimos** → Novo empréstimo (escolha mensal/diário; ao ativar, as parcelas são geradas automaticamente).
4. **Pagamentos** → Lançar pagamento (a alocação nas parcelas em aberto é automática).

## Persistência

PostgreSQL, Redis e `storage/` usam volumes Docker nomeados; dados sobrevivem a reinicializações de containers.

## Documentação

Ver diretório `docs/` (arquitetura, modelo de dados, métricas, regras financeiras, matriz de permissões, endpoints, cache, armazenamento, backup, checklist, decisões técnicas).

## Status

Em desenvolvimento. Não considerar pronto para produção sem revisão específica de segurança, backups, recuperação e configuração de implantação (ver docs/checklist-implantacao.md).