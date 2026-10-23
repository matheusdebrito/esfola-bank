# Esfola Bank — revisão da experiência operacional

## Objetivo
Priorização dos fluxos reais da empresa: **identificar valores vencidos**, **contatar clientes**, **registrar pagamentos**, **abrir empréstimos** e **acompanhar o caixa**. Sem incluir indicadores financeiros artificiais ou modificar a forma de cálculo do banco.

## Estrutura implementada
- Navegação de desktop agrupada por Operação, Gestão e Administração, sem emojis e com indicadores da seção ativa.
- Menu mobile acessível por botão, com cinco atalhos na barra inferior (Financeiro para quem possui acesso; Pagamentos para demais usuários).
- Cabeçalho com contexto da tela e atalhos de operação, conforme perfil do usuário.
- Visão geral com quatro KPIs, avisos do dia, capital disponível para perfis autorizados, vencimentos e cobranças prioritárias.
- Acesso direto a **Novo empréstimo** e **Receber** por parâmetros de URL que abrem os formulários existentes; também permite preselecionar contrato no recebimento.
- Fila de Cobranças com WhatsApp direto quando o cliente possui telefone cadastrado. A mensagem inclui valores e datas já fornecidos pela API.
- Financeiro abre o formulário de nova movimentação sob demanda, deixando saldo e extrato em destaque.
- Tabelas no celular exibem até quatro dados principais e permitem expandir os demais, mantendo ações visíveis.
- Modais mobile com tamanho apropriado, fechamento explícito, Escape, gerenciamento de foco e rolagem independente.
- Login reformulado, mantendo a logo existente, credenciais e autenticação reais.
- Componentes visuais com tokens coerentes e suporte a redução de movimento.

## Limites de escopo
- Não foram criadas novas métricas no banco, contabilizações contábeis ou fluxos financeiros não existentes. Os dados permanecem nas fontes de API já validadas.
- A nova interface não altera nem migra o banco de dados.
- O contato WhatsApp abre o aplicativo externamente e **não** registra histórico de cobranças automaticamente.
- O layout responsivo foi validado pelo **build TypeScript/Vite**, mas precisa de inspeção visual com navegador em larguras 320/375/768/1280px antes de considerar todos os cenários perfeitos.

## Checklist funcional após o deploy
1. Login e logout (ambos com redirecionamento correto).
2. Acessar a aplicação em 320px e 375px: navegação inferior, menu lateral, páginas sem rolagem horizontal do body.
3. Abrir “Novo empréstimo” pelo cabeçalho e confirmar que o modal aparece.
4. Abrir um contrato ativo e clicar em “Registrar pagamento”: o formulário deve abrir com o contrato selecionado.
5. Verificar os números de recebimentos, carteira aberta e vencido com dados reais.
6. Confirmar links de WhatsApp em clientes com telefone, e ação desabilitada para clientes sem telefone.
7. Validar Financeiro em ADMIN, MANAGER, AUDITOR (somente leitura) e OPERATOR (sem acesso).
8. Confirmar que o caixa não é alterado por simples navegação e que estornos/lançamentos mantêm seus valores.
9. Conferir uma listagem grande em desktop e os detalhes expansíveis das linhas no celular.
10. Em qualquer erro de rede, manter informações claras e a possibilidade de recuperar a tela.

**Migrações Prisma:** nenhuma nova migração neste PR.
