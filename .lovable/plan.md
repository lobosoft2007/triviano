## Fase A — Motor de impressão server-side (execução completa)

Reissuindo o plano final aprovado, para você clicar em **Implementar plano**.

### Bloco 1 — Migração `print_jobs` + flag no cadastro

- Tabela `public.print_jobs`: `id, empresa_id, printer_id, order_id (nullable), tipo, payload jsonb, status ('pending'|'printing'|'done'|'failed'|'expired'), attempts, last_error, claimed_at, created_at, printed_at, expires_at (default now()+30min)`
- Índices: `(empresa_id, status, created_at)`, `(printer_id, status)`
- RLS: staff da empresa lê/escreve seu tenant; agente entra por endpoint que usa `service_role` após validar token
- GRANT: `authenticated` (leitura/manutenção), `service_role` (all)
- Coluna nova `config_impressoras.imprime_pedido_completo boolean not null default false`

### Bloco 2 — Tabela `printer_agent_tokens`

- Colunas: `id, empresa_id, nome, token_hash text (SHA-256 hex, único), ativo boolean, last_seen_at, created_at`
- **Nunca** guarda o token em texto puro
- RLS: só master admin da empresa lê/insere/revoga
- RPC `create_printer_agent_token(p_nome text)` → gera `encode(gen_random_bytes(32),'hex')`, salva hash, retorna o texto puro **uma única vez**

### Bloco 3 — RPCs

- `enqueue_print_jobs(p_order_id uuid)` — resolve categoria→impressora, cria 1 job por setor com itens filtrados; para toda impressora com `imprime_pedido_completo=true`, cria job adicional `tipo='pedido_completo'` com **todos** os itens + cliente + endereço + total + pagamento
- `claim_print_jobs(p_empresa_id uuid, p_limit int)` — `FOR UPDATE SKIP LOCKED`, atômico, incrementa `attempts` e seta `claimed_at`
- `ack_print_job(p_job_id uuid, p_ok boolean, p_error text)` — `done` ou `failed` (respeita `attempts >= 3`)
- `pg_cron` a cada 1 min: expira `pending` com `expires_at < now()`; devolve `printing` presos > 2 min para `pending` até `attempts >= 3`

### Bloco 4 — Endpoints em `src/routes/api/public/print-agent/`

- `claim.ts` (POST), `ack.ts` (POST), `heartbeat.ts` (POST)
- Autenticação: header `x-agent-token` → SHA-256 → lookup em `printer_agent_tokens.token_hash` → obtém `empresa_id`, atualiza `last_seen_at`
- CORS + tratamento de erros com o padrão do projeto

### Bloco 5 — Gatilhos de enfileiramento

Chamar `enqueue_print_jobs(order_id)` (sem tocar em nada financeiro):
- Após finalização de pedido pago (delivery/balcão)
- Após "Enviar para cozinha" (mesa)
- Após confirmação de pedido iFood
- No botão novo "Imprimir cupom de teste" (job `tipo='teste'`)

### Bloco 6 — UI no `/caixa` → Configurações → Impressão

- Switch **"Imprimir pedido completo (balcão)"** no `PrinterEditorDialog`
- Botão **"Cupom de teste"** em cada card de impressora
- Nova aba **"Agentes"**: criar token (mostra texto puro 1 vez com "Copiar"), revogar, `last_seen_at`
- Badge 🟢/🔴 no card da impressora (agente respondeu < 60s)

### Fora do escopo desta rodada

- Agente Node local (ESC/POS, TCP:9100, empacotamento) → **Fase B**, plano separado após validar a fila em produção
- Motor financeiro, RLS de tabelas existentes, meios de pagamento, webhook MP (protegidos por `mem://constraints/motor-financeiro-protegido`)
- Fluxo WebUSB/Serial atual — coexiste

### Confirmações técnicas já validadas

- `pg_cron` e `pg_net` já habilitados no projeto
- Tokens sempre em SHA-256; texto puro nunca persistido
- Claim atômico via `FOR UPDATE SKIP LOCKED`
- TTL de 30 min + polling default 1s no agente (Fase B)
