# Estratégia de Backup e Restauração

## O que fazer backup

1. **PostgreSQL**: dump lógico (`pg_dump`) do banco `emprestimo`. Inclui todas as entidades, políticas financeiras e trilha de auditoria.
2. **Redis**: não é fonte oficial; pode ser recriado. Opcionalmente fazer backup do arquivo append-only (`appendonly.aof`) se desejar preservar cache.
3. **Documentos**: diretório `storage/clients/` (volume persistente).

## Comandos de backup (exemplo)

```bash
# Banco
docker exec emprestimo-postgres pg_dump -U emprestimo -d emprestimo > backup_$(date +%F).sql

# Documentos
tar czf backup_storage_$(date +%F).tar.gz -C /caminho/do/host storage/
```

## Restauração

```bash
# Recriar containers
docker compose up -d

# Restaurar banco
cat backup_$(date +%F).sql | docker exec -i emprestimo-postgres psql -U emprestimo -d emprestimo

# Restaurar documentos
tar xzf backup_storage_$(date +%F).tar.gz -C /caminho/do/host

# Executar migrations (se necessário)
docker compose exec backend npx prisma migrate deploy
```

## Procedimentos

- Testar restauração periodicamente em ambiente isolado.
- Manter backups fora do mesmo servidor que hospeda os containers.
- Retenção conforme política da empresa (definir por LGPD/regulamento aplicável).
