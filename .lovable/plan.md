## Plano: seguir sem credenciais iFood agora

Sim, dá pra seguir tranquilo. A arquitetura da Fase 1 já foi desenhada para que credenciais sejam preenchidas depois, sem bloquear nada do resto do sistema.

### O que já está pronto e funciona SEM credenciais iFood
- Precificação por canal (`preco_ifood`) nos produtos, variações e adicionais.
- CRUD de **Lojas iFood** em `/admin` (você cadastra depois, quando tiver Client ID / Secret / Merchant ID).
- CRUD de **Entregadores** e **Painel de Entregas** no `/caixa` (funciona 100% para delivery próprio, independente de iFood).
- Campo `canal_venda` em `orders` (PROPRIA | IFOOD | BALCAO | MESA).
- Toggle "Loja aberta/fechada/pausada" no admin (visual; só efetiva no iFood quando credenciais chegarem).

### O que vou implementar AGORA (sem depender de credenciais)
1. **Aplicar markup iFood em massa**: botão no `/admin > iFood` que aplica um `markup_ifood_percentual` (ex.: +20%) sobre `preco_base` em todos os produtos/variações/adicionais, gravando em `preco_ifood`. Overwrite opcional.
2. **Coluna `markup_ifood_percentual`** em `empresas` (default 20%).
3. **Painel de Entregas ativo no /caixa** para delivery próprio já rodando em produção (independe do iFood).
4. **Validação end-to-end do fluxo próprio**: pedido PWA → Caixa → atribuição de entregador → em rota → entregue, com registro em `entregas` e comissão calculada.

### O que fica PAUSADO até você trazer as credenciais (segunda-feira)
- Edge Functions `ifood-poll-events`, `ifood-dispatch-order`, `ifood-sync-catalog`.
- Cron `pg_cron` de polling a cada 30s.
- OAuth token refresh automático.
- Sincronização real de status (confirmar/despachar/cancelar) com o iFood.
- Recebimento de pedidos iFood no Caixa.

Quando você voltar com as credenciais, é só colar em `/admin > iFood (Lojas)` e eu ligo a Fase 1.5 (integração real) — nenhuma refatoração adicional necessária, porque o schema e a UI já estão preparados.

### Ordem de execução hoje
1. Migração: adicionar `empresas.markup_ifood_percentual`.
2. RPC `apply_ifood_markup(p_empresa_id, p_overwrite)`.
3. UI no `/admin > iFood`: input de percentual + botão "Aplicar em massa".
4. Smoke test do fluxo de entrega própria no `/caixa`.

Sem alterações no motor financeiro, fiscal, ou nas policies existentes.
