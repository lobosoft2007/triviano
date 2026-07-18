# Fase T-Ops — Operação, Observabilidade e Suporte do parque Triviano Tap

Objetivo: dar ao dono da empresa (e ao suporte Triviano) as ferramentas para **operar centenas de maquininhas/celulares Tap em produção** sem depender do desenvolvedor. Foco em telemetria, alertas, ações remotas seguras e runbooks.

## 1. Telemetria dos devices (heartbeat + eventos)

Ampliar `pos_devices` com colunas de saúde: `last_seen_at`, `app_version`, `os_version`, `battery_pct`, `network_type` (wifi/4g), `printer_ok`, `nfc_ok`, `sdk_provider_ativo`, `last_error`, `last_error_at`.

Nova tabela `pos_device_events` (append-only): `device_id`, `tipo` (`heartbeat`|`login`|`erro_sdk`|`erro_pix`|`erro_impressao`|`ota_aplicada`|`config_alterada`), `payload jsonb`, `created_at`. RLS por empresa, particionamento lógico por dia via índice.

Endpoint público autenticado `POST /api/public/pos/heartbeat` (assinado com `device_token`) recebe payload a cada 60s quando app está aberto.

## 2. Ações remotas seguras

Nova tabela `pos_device_commands`: `device_id`, `comando` (`bloquear`|`desbloquear`|`forcar_logout`|`reimprimir_ultimo`|`limpar_fila_offline`|`ping`|`atualizar_config`), `payload`, `status` (`pendente`|`entregue`|`executado`|`falhou`), `created_by`, timestamps.

O app faz long-poll leve (`GET /api/public/pos/commands`) junto com o heartbeat; ao executar retorna `ACK` via `POST /api/public/pos/commands/:id/ack`. Bloqueio remoto invalida `pos_devices.ativo=false` e o app cai para tela de "device bloqueado pelo admin".

## 3. Painel Admin → Frota (POS/Tap)

Nova aba `Admin → Empresa → Frota` (renomeia/estende "Maquininhas POS"):
- Grid com um card por device: apelido, garçom logado, versão, bateria, rede, últimos erros, "online há Xs".
- Filtros: só offline > 5min, com erro nas últimas 24h, versão desatualizada.
- Ações por card: **Ping**, **Reimprimir último cupom**, **Limpar fila offline**, **Forçar logout**, **Bloquear/Desbloquear**, **Ver histórico** (drawer com `pos_device_events`).
- KPIs no topo: devices online agora, % com bateria <20%, erros nas últimas 24h, valor transacionado hoje (PIX+Cartão via `tap_pix_charges`+`tap_card_charges`).

Guard: só `admin master` da empresa. Superadmin Triviano tem visão cross-tenant read-only em `/superadmin/frota`.

## 4. Alertas

Job `pg_cron` a cada 5 min (`/api/public/hooks/pos-health-check`):
- Device sem heartbeat > 10min em horário comercial da empresa → cria `notificacoes_cliente` para admins e opcionalmente WhatsApp (usa integração existente).
- Falhas repetidas de PIX/cartão (>3 em 15 min mesmo device) → mesmo alerta.
- Bateria < 15% em device ativo → alerta suave (apenas painel).

## 5. Logs financeiros consolidados

View `v_tap_transactions_daily` unindo `tap_pix_charges` + `tap_card_charges` por dia/empresa/device/garçom. Relatório A4 novo no framework `ReportShell`: **"Operação Tap — Fechamento por device"** com filtro por data/loja/garçom, totais e gráfico de barras (via `ChartRenderer`).

## 6. OTA & versão mínima

Tabela `pos_app_releases` (`versao`, `versao_minima_obrigatoria`, `notas`, `ativo`). Endpoint `GET /api/public/pos/version-check` retorna se o device precisa atualizar. App bloqueia uso abaixo da mínima e mostra QR/URL do APK/loja. Superadmin gerencia releases em `/superadmin/tap-releases`.

## 7. Runbooks e suporte

Arquivos entregues no zip da fase:
- `docs/RUNBOOK-SUPORTE.md`: fluxos "device sumiu", "PIX não confirma", "impressora travada", "estorno negado", "trocar garçom no turno".
- `docs/SLA-OPERACAO.md`: janelas de manutenção, política de retenção de eventos (90 dias), plano de escalonamento.

## Detalhes técnicos

- Migrations: `pos_devices` (novas colunas), `pos_device_events`, `pos_device_commands`, `pos_app_releases`, view `v_tap_transactions_daily`. Sempre `GRANT` + RLS por `empresa_id` via `current_empresa_id()`; superadmin via `is_superadmin()`.
- Endpoints em `src/routes/api/public/pos/*` com verificação de assinatura HMAC(`device_token`, body) — segue padrão já usado em `/api/public/tap/*`. Sem PII no payload.
- Frontend Admin: `src/pages/admin/tabs/FrotaTab.tsx`, componentes `DeviceCard`, `DeviceHistoryDrawer`, hook `useDeviceCommands`. Realtime via canal Postgres em `pos_device_events` para atualização ao vivo.
- App RN (`triviano-tap`): módulo `lib/telemetry.ts` (heartbeat + fila de eventos com retry), `lib/remoteCommands.ts` (poll + ACK), tela `DeviceBlockedScreen`, integração com `lib/tapApi.ts` para reportar erros de SDK/PIX/impressora. Persistência via `AsyncStorage`.
- Sem alterações no motor financeiro protegido (`_finalize_order_financials`, triggers de fiado/cashback, webhook MP) — apenas leituras/inserts em novas tabelas.
- Bump para versão **1.9.0**.

## Entregáveis

1. Migrations aplicadas + endpoints públicos + guard/superadmin.
2. Aba **Frota** no Admin com ações remotas e histórico.
3. Job pg_cron de health-check + alertas.
4. Relatório "Operação Tap — Fechamento por device".
5. OTA/version gate + tela superadmin de releases.
6. Zip `triviano-tap-fase-t-ops.zip` com módulos RN de telemetria/comandos + runbooks.
