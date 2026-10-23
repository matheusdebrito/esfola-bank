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

## 🚀 Primeira execução (passo a passo)

### 1. Clonar o repositório

```bash
git clone https://github.com/matheusdebrito/esfola-bank.git
cd esfola-bank
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Abra o `.env` e ajuste os segredos (nunca commitar valores reais). Os valores padrão de desenvolvimento já funcionam para rodar localmente.

### 3. Subir os containers

```bash
docker compose up -d
```

Aguarde todos os containers ficarem `healthy` (verifique com `docker compose ps`).

### 4. Aplicar migrações do banco de dados

```bash
docker compose exec backend npx prisma generate
docker compose exec backend npx prisma migrate deploy
```

> **Banco criado antes da pasta `migrations` (ex.: banco legado):** marque o baseline como aplicado uma única vez, sem recriar as tabelas:
> ```bash
> docker compose exec backend npx prisma migrate resolve --applied 0001_init
> docker compose exec backend npx prisma migrate status
> ```
> Em bancos novos, o `migrate deploy` já cria toda a estrutura.

### 5. Verificar se o backend respondeu

```bash
curl http://localhost:4000/health
# Esperado: {"status":"ok","service":"emprestimo-backend","env":"development"}
```

### 6. Acessar a aplicação

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000/api/v1`

O backend cria automaticamente um administrador **somente quando não existe nenhum usuário** no banco, usando `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`.

**Credenciais padrão de desenvolvimento:**

| Perfil | Email | Senha |
|--------|-------|-------|
| Admin | `admin@emprestimo.local` | `Admin@12345` |
| Operador | `operador@emprestimo.local` | `Operador@12345` |

> Altere a senha após o primeiro login e defina `ADMIN_PASSWORD` forte em produção.

## Comandos úteis

### Backend (local, sem Docker)

```bash
cd backend
npm install
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run lint        # eslint src
npm run build       # tsc
npm run dev         # tsx watch src/server.ts
```

### Frontend (local, sem Docker)

```bash
cd frontend
npm install
npm run build       # tsc + vite build
npm run dev         # vite
```

### Testes (via Docker)

```bash
docker compose exec backend npx vitest run
```

### Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Parar ambiente

```bash
docker compose down
```

### Reiniciar após mudanças no código

```bash
docker compose up -d --build
```

## Fluxo básico de uso

1. **Políticas** → Nova política (juros flat, multa fixa, juros diário; marque "Definir como padrão").
2. **Clientes** → Novo cliente (CPF válido e telefone para cobrança via WhatsApp).
3. **Empréstimos** → Novo empréstimo (escolha mensal/diário; ao ativar, as parcelas são geradas automaticamente).
4. **Pagamentos** → Lançar pagamento (selecione as parcelas; o valor total é calculado automaticamente).

## Persistência

PostgreSQL, Redis e `storage/` usam volumes Docker nomeados; dados sobrevivem a reinicializações de containers.

## Documentação

Ver diretório `docs/` (arquitetura, modelo de dados, métricas, regras financeiras, matriz de permissões, endpoints, cache, armazenamento, backup, checklist, decisões técnicas).

## Status

Em desenvolvimento. Não considerar pronto para produção sem revisão específica de segurança, backups, recuperação e configuração de implantação (ver docs/checklist-implantacao.md).