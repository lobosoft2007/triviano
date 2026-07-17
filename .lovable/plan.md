
# Ciclo completo iFood + Entrega Própria (multi-tenant)

Objetivo: cada empresa (tenant) conecta sua conta iFood e/ou opera entrega própria (com entregadores cadastrados), com sincronização de cardápio, **precificação independente por canal (interno vs iFood)**, recebimento e ciclo de vida completo do pedido, sem quebrar o motor financeiro protegido.

---

## 1. Precificação por canal (NOVO — pré-requisito)

Restaurantes normalmente inflam o preço no iFood para absorver a comissão (~27%). O sistema precisa suportar preço interno **e** preço por marketplace, sem contaminar o cardápio do PWA/Caixa.

### 1.1 Schema
- **`products`**: adicionar `preco_ifood NUMERIC` (nullable — quando nulo, usa `price` normal).
- **`produtos_price_options`**: adicionar `preco_ifood NUMERIC` (mesma regra por variação de tamanho).
- **`produtos_addons`**: adicionar `preco_ifood NUMERIC` (adicionais também têm preço diferente).
- **`canais_preco`** (futuro-proof) — enum lógico `INTERNO | IFOOD | RAPPI | ...`. Fase 1 usa só colunas dedicadas; fase 3 migra para tabela `produto_preco_canal (produto_id, canal, preco)` quando surgirem 3+ marketplaces.
- **`empresas`**: `markup_ifood_percentual NUMERIC DEFAULT 0` — botão "Aplicar markup em massa" no admin (ex.: +30% em todos os itens sem `preco_ifood` definido).

### 1.2 UI Admin — cardápio
- No editor de produto (`ProductDetailFields`) e nas variações (`produtos_price_options`) e adicionais (`produtos_addons`): novo campo "Preço iFood" com placeholder "= preço interno" quando vazio, ao lado do preço atual.
- Nova ação em `/admin > Produtos`: **"Recalcular preços iFood"** — aplica `markup_ifood_percentual` em massa (com preview antes de salvar).
- Coluna extra na listagem: mostra preço interno + preço iFood lado a lado, badge amarelo quando estiver usando fallback.

### 1.3 Uso
- `ifoodSyncCatalog` **sempre** envia `preco_ifood ?? price` para o iFood.
- Pedidos recebidos do iFood registram no `order_items.unit_price` o **preço iFood praticado** (o que o cliente pagou lá), preservando o histórico correto para relatórios.
- PWA/Caixa/Mesa continuam usando `price` normalmente — zero impacto no fluxo interno.

---

## 2. Modelagem (multi-tenant por `empresa_id`)

Novas tabelas, todas com RLS + GRANTs isoladas por `empresa_id` via `can_manage_empresa`.

### 2.1 Canais e credenciais iFood
- **`canais_venda`** — enum lógico: `PWA`, `CAIXA`, `MESA`, `IFOOD`, `TELEFONE`.
- **`ifood_merchants`** — 1..N por empresa: `merchant_id (uuid iFood), nome, client_id, client_secret (cripto), access_token, refresh_token, token_expires_at, polling_enabled, status_loja, ultima_sincronizacao`.
- **`ifood_event_log`** — auditoria: `event_id, event_type, order_id_ifood, payload jsonb, processado_em, erro`.
- **`ifood_produto_map`** — `products.id` ↔ `ifood_item_id, ifood_category_id, disponivel, ultimo_sync`. Preço vem de `products.preco_ifood`, não é duplicado aqui.

### 2.2 Entrega própria
- **`entregadores`** — `nome, telefone, cpf, placa_veiculo, tipo_veiculo, ativo, comissao_percentual, comissao_fixa_por_entrega, user_id (opcional, p/ PWA fase 2)`.
- **`entregas`** — 1:1 com `orders`: `order_id, entregador_id, canal (PROPRIA/IFOOD), status (PENDENTE/ATRIBUIDA/EM_ROTA/ENTREGUE/DEVOLVIDA), saiu_para_entrega_em, entregue_em, taxa_entrega, valor_comissao, distancia_km, coord_origem, coord_destino, observacao`.
- **`entregador_sessoes`** — turnos: `entregador_id, inicio, fim, total_entregas, total_comissao`.

### 2.3 Ajustes em `orders`
- `canal_venda` (default `PWA`), `pedido_externo_id` (id do iFood), `entregador_id`, `entrega_id`.
- **Não** mexer em `finalize_order_paid`, `_finalize_order_financials`, triggers de estoque, cashback, RLS existente.

---

## 3. Integração iFood (Merchant API oficial)

### 3.1 Server functions (`src/lib/ifood/*.functions.ts`)
- `ifoodOAuthStart` / `ifoodOAuthCallback` — vincula merchant à empresa.
- `ifoodRefreshToken` — auto-refresh quando `token_expires_at < now + 5min`.
- `ifoodSyncCatalog` — envia produtos + `preco_ifood` + adicionais para o iFood.
- `ifoodSetStoreStatus(OPEN/CLOSED)` — abre/fecha loja; conectado a `empresas.aberto` + horários.
- `ifoodConfirmOrder`, `ifoodDispatchOrder`, `ifoodCancelOrder(motivo)`, `ifoodReadyToPickup`.

### 3.2 Recebimento — server route pública
- `src/routes/api/public/ifood/polling.ts` (POST, `x-cron-secret` HMAC) — chamada por **pg_cron a cada 30s**. Para cada merchant com `polling_enabled=true`, chama `GET /events:polling`, grava em `ifood_event_log`, cria/atualiza `orders` (com `canal_venda='IFOOD'`, `pedido_externo_id`, itens via `ifood_produto_map` gravando `unit_price = preco iFood praticado`), gera `entregas`, e chama `POST /events/acknowledgment`.
- `src/routes/api/public/ifood/webhook.ts` (opcional, HMAC).
- Pedidos iFood entram na esteira `status_pedido` já existente, KDS e impressoras (roteamento por setor) sem modificação.

### 3.3 UI `/admin` → nova aba **iFood**
- Cadastro de merchants (OAuth do app único Lovable — ver Pergunta 1).
- Botão "Sincronizar cardápio" + mapa produto↔item iFood com status.
- Abrir/fechar loja + toggle de polling.
- Log de eventos (últimos 200).

---

## 4. Entrega própria — UI e ciclo

### 4.1 `/admin` → nova aba **Entregadores**
- CRUD de `entregadores` (nome, telefone, veículo, regra de comissão).
- Relatório por período: entregas, km, comissão a pagar (integrado à Tesouraria como conta a pagar ao fechar turno).

### 4.2 `/caixa` → novo painel **Entregas** (Kanban)
- Colunas: `Pronto p/ sair` → `Em rota` → `Entregue`.
- Cada card: pedido, endereço, valor, taxa, botão "Atribuir entregador" (select ativos), "Saiu para entrega", "Entregue".
- Pedidos iFood aparecem no mesmo painel com tag "iFood" e ao "Saiu para entrega" disparam `ifoodDispatchOrder` automaticamente.
- Filtro: Próprias / iFood / Todas.

### 4.3 PWA do entregador (`/entregador`, opcional Fase 2)
- Login OTP por telefone.
- Lista de entregas atribuídas, botões "Cheguei"/"Entreguei", link `maps:`.

---

## 5. Cardápio unificado (fonte da verdade = `products`)

- `ifoodSyncCatalog` monta payload de `products` + `categories` + `produtos_price_options` + `produtos_addons` usando **`preco_ifood ?? price`** em cada nível.
- Alteração de preço/estoque na retaguarda dispara re-sync incremental (trigger → `pg_notify` → server fn debounced).
- Item "esgotado" no PWA/Caixa → `disponivel=false` no iFood.

---

## 6. Segurança e isolamento

- Todas as tabelas novas: RLS `USING (can_manage_empresa(empresa_id))` + GRANTs (`authenticated`, `service_role`).
- Segredos iFood por empresa criptografados via `pgsodium/vault` — nunca expostos ao client.
- Rotas `/api/public/ifood/*` verificam `x-cron-secret` (HMAC) + `merchant_id` conhecido.
- **Zero alteração** em `finalize_order_paid`, `pagamentos_pedido`, `meios_pagamento`, webhook Mercado Pago, trava PIX.

---

## 7. Cron & jobs

- `pg_cron` 30s → `POST /api/public/ifood/polling`.
- `pg_cron` 5min → refresh de tokens expirando.
- `pg_cron` 1min → sincroniza status da loja conforme horário da empresa.

---

## 8. Fases

**Fase 1 — MVP funcional**
- Precificação por canal (schema + UI cardápio).
- Modelagem completa + RLS.
- Cadastro de merchants iFood + OAuth.
- Polling + criação de pedidos iFood no Caixa (ciclo confirmar/despachar/cancelar).
- Entregadores CRUD + painel Entregas no Caixa.

**Fase 2**
- Sincronização de cardápio bidirecional + esgotado automático.
- Comissão de entregadores integrada à Tesouraria.
- PWA do entregador.

**Fase 3**
- Relatórios: performance por canal, tempo médio de entrega, mapa de calor.
- Migração para tabela `produto_preco_canal` genérica.
- Rappi, 99Food, Uber Eats reutilizando `canal_venda` + preço por canal.

---

## 9. O que **não** muda
Motor financeiro, RLS existente, cashback, fiado, Mercado Pago, NFC-e, KDS, impressão térmica. Matriz de permissões só ganha flags novas: `pode_gerenciar_ifood`, `pode_gerenciar_entregas`, `pode_atribuir_entregador`.

---

## Perguntas antes de codar
1. **Credenciais iFood**: cada cliente cola o próprio `client_id/secret` no `/admin`, ou usamos **um app único Lovable/Triviano** homologado no iFood e cada empresa só autoriza via OAuth? (recomendo o segundo — muito mais simples para o cliente final).
2. **PWA do entregador**: entra na Fase 1 ou fica na Fase 2?
3. **Comissão de entregador**: fixa por entrega, % do pedido, ou por km? Posso suportar os três; confirma o padrão inicial.
4. **Markup iFood padrão**: sugerimos 30% como default no `empresas.markup_ifood_percentual` para novas contas, com o cliente ajustando? Ou começar em 0% e forçar preenchimento manual?
