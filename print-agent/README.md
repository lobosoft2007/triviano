# Triviano Print Agent

Serviço local que consome a fila `print_jobs` do backend e envia comandos ESC/POS para impressoras térmicas via TCP:9100.

## Requisitos

- Node.js 18+ instalado no PC da loja
- Impressoras térmicas em rede (Ethernet ou Wi-Fi) com IP fixo, escutando na porta 9100 (padrão ESC/POS)

## Instalação

```bash
cd print-agent
npm install
cp .env.example .env
# edite o .env colando o AGENT_TOKEN gerado em /caixa > Impressoras > Agentes
npm run build
npm start
```

## Rodar como serviço no Windows

Recomendado: [nssm](https://nssm.cc/) para transformar o `node dist/index.js` em um serviço Windows que sobe com o computador.

```bat
nssm install TrivianoPrintAgent "C:\Program Files\nodejs\node.exe" "C:\triviano\print-agent\dist\index.js"
nssm set TrivianoPrintAgent AppDirectory "C:\triviano\print-agent"
nssm start TrivianoPrintAgent
```

## Rodar como serviço no Linux (systemd)

```ini
# /etc/systemd/system/triviano-print-agent.service
[Unit]
Description=Triviano Print Agent
After=network.target

[Service]
WorkingDirectory=/opt/triviano/print-agent
ExecStart=/usr/bin/node dist/index.js
Restart=always
User=triviano

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now triviano-print-agent
```

## Como funciona

1. A cada `HEARTBEAT_INTERVAL_MS` (default 30s) o agente chama `/api/public/print-agent/heartbeat` para se anunciar e receber a lista de impressoras da loja.
2. A cada `POLL_INTERVAL_MS` (default 2s) chama `/api/public/print-agent/claim` para reivindicar até 10 jobs pendentes.
3. Para cada job, formata em ESC/POS (encoding configurável, default `cp850`) e envia por TCP para o IP da impressora destino.
4. Confirma com `/api/public/print-agent/ack` (ok=true) ou reporta erro (ok=false). Falhas voltam para a fila com backoff exponencial (10s → 40s → 90s → 160s), até 5 tentativas.

Se o agente cair entre o `claim` e o `ack`, o job fica bloqueado por 30s e é automaticamente re-reivindicado pelo próximo poll — sem cron.

## Troubleshooting

- **`timeout host:port`** → verifique se a impressora está ligada, na mesma rede e se o IP no admin bate com o real.
- **Caracteres estranhos** → ajuste `PRINTER_ENCODING` (`cp850`, `cp860`, `utf8`) no `.env` ou por impressora no admin.
- **Nenhum job chega** → confira que o `AGENT_TOKEN` corresponde ao gerado na empresa correta e que está ativo em `/caixa > Impressoras > Agentes`.
