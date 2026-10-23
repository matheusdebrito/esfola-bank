# Estratégia de Cache e Consistência

## Princípio

O PostgreSQL é a fonte oficial de todos os dados. O Redis é usado **apenas** para melhorar desempenho de dashboards e relatórios, nunca para integridade financeira, autorizações ou saldos.

## Regras obrigatórias

1. Não usar Redis como fonte oficial de pagamentos, saldos, autorizações ou obrigações.
2. Operações financeiras críticas consultam e atualizam o PostgreSQL de forma transacional.
3. Pagamentos nunca são confirmados com base em saldo em cache.
4. Permissões revogadas não são servidas a partir de cache (validadas no banco a cada requisição sensível).
5. O sistema continua funcionando (com perda de desempenho) se o Redis ficar indisponível.

## Estratégia implementada

- **Cache-aside** com chaves versionadas (`cache:v1:<dominio>:<chave>`).
- **TTL** de 60 segundos nos dashboards como proteção adicional.
- **Invalidação via outbox**: toda operação de escrita que afete dados consultados em dashboards registra um evento em `CacheInvalidationEvent` na mesma transação dos dados (PostgreSQL).
- **Worker idempotente**: processa eventos pendentes a cada 5s, exclui a chave do Redis e marca o evento como processado. Eventos reprocessados são inofensivos (exclusão de chave inexistente é idempotente).
- **Domínios de cache**: clients, loans, installments, payments, dashboards, reports, permissions.
- **Falha do Redis**: operações de cache falham silenciosamente (logs de aviso); o sistema lê direto do PostgreSQL.
- **Leitura imediatamente consistente**: dashboards que exigem consistência imediata devem consultar o PostgreSQL diretamente (não usar cache).

## Testes de consistência exigidos

- Atualização do banco com invalidação.
- Falha temporária do Redis.
- Evento de invalidação processado mais de uma vez (idempotência).
- Evento pendente após falha do worker.
- Corridas entre leitura, escrita e cache.
- Leitura consistente de pagamentos e saldos (direto no PostgreSQL).
