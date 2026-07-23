# Plano B v3 — Agente Local de Impressão

## Objetivo
Serviço Node.js local que consome a fila `print_jobs`, formata em ESC/POS e envia para impressoras térmicas via TCP:9100, com retry automático e recuperação por soft-fail.

## Estrutura do pacote (`print-agent/`)
```text
print-agent/
  package.json
  tsconfig.json
  .env.example
  README.md
  src/
    index.ts          # loop principal (poll + dispatch)
    config.ts         # carrega .env (URL, token, encoding, intervalos)
    api.ts            # chamadas /claim, /ack, /heartbeat
    escpos.ts         # formatação (sector vs full order), encoding CP850/UTF-8
    tcp.ts            # envio TCP:9100 com timeout
    logger.ts         # logs simples em stdout + arquivo
```
Independente do app web; roda com `npm start` na loja.

## Banco de dados (migração única)
1. `print_jobs`: adicionar `attempts int default 0`, `next_attempt_at timestamptz default now()`, `last_error text`.
2. `claim_print_jobs`: reservar jobs onde `status='queued' AND next_attempt_at<=now()` **ou** `status='processing' AND locked_until<now()`. `locked_until = now()+30s`. Incrementa `attempts`.
3. `ack_print_job(job_id, ok, error_message)`:
   - `ok=true` → `status='done'`.
   - `ok=false` e `attempts<5` → `status='queued'`, backoff `next_attempt_at = now()+ (attempts^2 * 10s)`, grava `last_error`.
   - `ok=false` e `attempts>=5` → `status='failed'`, grava `last_error`.
4. `pg_cron` de retenção: apaga jobs `done`/`failed` com mais de 7 dias (diário).
5. Sem cron de expiração de 30min — soft-fail é resolvido pelo próprio `claim_print_jobs`.

## Fluxo do agente
1. `POST /api/public/print-agent/heartbeat` a cada 30s (atualiza `printer_agent_tokens.last_seen_at`).
2. `POST /api/public/print-agent/claim` a cada 2s (config): recebe lote de jobs.
3. Para cada job: formata em ESC/POS conforme `layout` (sector/full), envia por TCP:9100 da impressora alvo.
4. `POST /api/public/print-agent/ack` com `{ok, error_message?}`.
5. Se o agente cair entre claim e ack, `locked_until` expira em 30s e outro poll re-reivindica automaticamente (sem cron, sem reversão manual).

## Formatação ESC/POS (`escpos.ts`)
- Layout **sector** (cozinha/bar/pizzaria): cabeçalho da empresa, número do pedido/senha, mesa/entregador, apenas itens do setor, adicionais, removidos, observações. Corte final.
- Layout **full** (via de balcão/entrega): pedido completo, totais, meio de pagamento, endereço se delivery.
- Encoding: default `cp850`, configurável por `PRINTER_ENCODING` no `.env` e override opcional por impressora (coluna `encoding` em `config_impressoras`, nullable).

## `.env.example`
```
AGENT_TOKEN=...            # token gerado no /caixa
API_BASE_URL=https://triviano.com.br
POLL_INTERVAL_MS=2000
HEARTBEAT_INTERVAL_MS=30000
PRINTER_ENCODING=cp850
LOG_FILE=./agent.log
```

## UI /caixa — "Fila de Impressão"
- Painel dentro de Impressoras: lista `print_jobs` recentes com colunas status, tentativas, impressora, criado, último erro.
- Badges de saúde por agente (online se `last_seen_at < 60s`).
- Botão "Reimprimir" por job (reseta `attempts=0`, `status='queued'`, `next_attempt_at=now()`).
- Contador de "atrasados" (queued > 30s).

## Ordem de execução
1. Migração DB (colunas, `claim_print_jobs`, `ack_print_job`, cron retenção, coluna `encoding` opcional).
2. Pacote `print-agent/` (código + README de instalação Windows/Linux).
3. UI da fila em `src/routes/_authenticated/caixa.tsx` + componente `PrintQueuePanel`.
4. Ajuste do `enqueue_print_jobs` para setar `next_attempt_at=now()` na criação.

## Fora do escopo
- Instalação automática do agente como serviço do Windows (documentado no README).
- Descoberta automática de impressoras na rede.
