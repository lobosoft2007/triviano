# Execução — Fase 1 (Banco + RPCs) e Fase 2 (Segurança do QR) — Módulo de Mesa v1.5.0

Decisões homologadas incorporadas: **QR** com `@zxing/browser`; **Geofencing** apenas como colunas no banco (sem UI/validação por enquanto); **OTP** nativo atual. Motor financeiro (PIX/Checkout) **não é tocado** — apenas adições isoladas.

## Fase 1 — Migração do Banco

### Enums
- `solicitacao_mesa_status`: `('aguardando','liberada','recusada','expirada')`
- `comanda_status`: `('aberta','aguardando_fechamento','fechada','cancelada')`

### Tabela `solicitacoes_mesa`
Campos de domínio: `empresa_id`, `numero_mesa`, `nome_cliente`, `telefone`, `user_id`, `status` (default `aguardando`), `host_origem`, `liberada_por`, `liberada_em`.

### Tabela `comanda_ativa`
Campos de domínio: `empresa_id`, `numero_mesa`, `solicitacao_id`, `user_id`, `nome_cliente`, `status` (default `aberta`), `total_parcial` (default 0), `fechada_em`.

### Coluna nova em `orders`
- `comanda_id uuid` (nullable, FK → `comanda_ativa`).

### Colunas de geofence em `empresas` (dormentes, sem UI agora)
- `mesa_exige_geofence boolean default false`, `latitude numeric`, `longitude numeric`, `geofence_raio_m integer default 200`, `mesa_qr_secret text` (segredo aleatório por empresa).

### Segurança (GRANT + RLS)
Ambas as tabelas: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;`
- **SELECT**: dono (`user_id = auth.uid()`) OU operador do tenant (`can_manage_empresa(empresa_id)`).
- **UPDATE**: operador do tenant; dono marca a própria como desistência.
- Escritas críticas via RPCs `SECURITY DEFINER`.

### Trigger de total
- `comanda_recalc_total()` em `orders`: recalcula `comanda_ativa.total_parcial = Σ orders.total` da comanda com `status_pedido <> 'Cancelado'`.

### Realtime
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_mesa, public.comanda_ativa;`

## Fase 1 — RPCs (`SECURITY DEFINER`)
- `mesa_token(p_empresa, p_numero)` → `substr(md5(empresa||':'||numero||':'||secret),1,10)`.
- `abrir_solicitacao_mesa(p_host, p_numero_mesa, p_token, p_nome, p_telefone)`: auth; resolve empresa por host; valida token; grava `host_origem`; insere `aguardando`.
- `liberar_mesa(p_solicitacao_id)`: admin + `can_manage_empresa`; cria `comanda_ativa`.
- `recusar_solicitacao_mesa` / `desistir_solicitacao_mesa`.
- `enviar_pedido_mesa(p_items, p_host, p_comanda_id, p_notes)`: chama `create_order` existente (sem alterá-lo) e vincula `comanda_id`.
- `fechar_comanda(p_comanda_id)`: dono/operador → `aguardando_fechamento`.

## Fase 2 — Segurança do QR
Token keyed-hash por mesa + validação de host obrigatória na RPC (bloqueia abertura remota e adivinhação de mesa).

## Fase 3 (Home) e Fase 4 (/mesa) — nesta rodada
- **Home**: bifurcação com cards `🛵 DELIVERY` e `🪑 CONSUMIR NA MESA` no escopo delivery.
- **Rota `/mesa`**: Nome+Telefone → OTP nativo → leitura de QR com `@zxing/browser` → tela de espera com "objeto rodando" (spinner) e status "Aguardando liberação do Caixa..." + botão "Desistir".
- **Realtime**: o celular assina a própria `solicitacoes_mesa` (por id); ao operador clicar "Liberar" no Caixa, o evento chega instantaneamente e o cardápio é liberado.

## Preservação
Nenhuma alteração em `create_order`, `finalize_order_paid`, webhook MP, `meios_pagamento`, trava PIX, RLS/GRANT existentes.

Fases 5–7 (carrinho modo mesa, "Minha Comanda", fila de Visto/fechamento no Caixa) e carimbo v1.5.0 ficam para a próxima rodada.
