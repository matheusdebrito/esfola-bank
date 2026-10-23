# Checklist de Implantação

## Pré-requisitos

- [ ] Docker e Docker Compose instalados
- [ ] `.env` criado a partir de `.env.example` com segredos fortes (JWT_SECRET, senhas do banco)
- [ ] Porta 4000 (backend), 5173 (frontend) disponíveis
- [ ] PostgreSQL (5432) e Redis (6379) não expostos publicamente por padrão

## Implantação

- [ ] `docker compose up -d` sobe todos os serviços
- [ ] Health checks de postgres e redis passam
- [ ] Migrations executadas: `docker compose exec backend npx prisma migrate deploy`
- [ ] Prisma Client gerado: `docker compose exec backend npx prisma generate`
- [ ] Backend responde `/health`
- [ ] Frontend carrega na porta 5173
- [ ] Login funciona com usuário cadastrado
- [ ] Dados persistem após reiniciar containers (`docker compose down` e `up`)

## Segurança

- [ ] Nenhuma credencial real no Git ou no Compose
- [ ] JWT_SECRET forte e único
- [ ] Cookies HttpOnly, Secure e SameSite (Secure=true em produção com HTTPS)
- [ ] CORS restrito à origem do frontend
- [ ] Rate limiting ativo
- [ ] Stack traces não expostos em produção (NODE_ENV=production)
- [ ] Senhas hasheadas (Argon2id ou fallback scrypt)
- [ ] CPF não exposto integralmente em listagens (máscara aplicada)

## Operações

- [ ] Backup do PostgreSQL agendado
- [ ] Backup do storage agendado
- [ ] Teste de restauração realizado
- [ ] Logs acessíveis (`docker compose logs -f backend`)

## Pronto para produção?

Não afirmar prontidão para produção sem revisão específica de segurança, backups, recuperação e configuração de ambiente de implantação.
