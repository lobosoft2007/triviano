## Objetivo

Adicionar ao Triviano dois módulos novos e um interruptor de configuração:

1. **Reservas** (cliente reserva pelo PWA; recepcionista gerencia no app do garçom / Tap).
2. **Fila de espera / walk-in** (recepcionista cria fila, avisa por WhatsApp/Push, arrasta o grupo para uma mesa física).
3. **Interruptor "Permitir pedidos na mesa pelo PWA do cliente"** por empresa (quando desligado, o QR da mesa só serve para ver cardápio/chamar garçom, não abre carrinho).

Tudo multi-tenant (isolado por `empresa_id` com RLS) e reaproveitando peças que já existem: `comanda_ativa`, `solicitacoes_mesa`, `NotifyClient` (WhatsApp+Push), matriz de permissões, `mesa_token` do QR.

---

## Parte 1 — Configuração no Admin (Reservas + Pedido na Mesa)

Nova aba **Admin → Empresa → Reservas & Sala**:

- **Capacidade por dia/horário**: matriz semana × faixa horária (ex.: seg–qui 19:00–22:00 = 40 lugares reserváveis; sex–sáb = 60). Passo padrão 30 min, configurável.
- **Janela mínima de antecedência** (ex.: reservar até 2 h antes) e **antecedência máxima** (ex.: 30 dias).
- **Tolerância de atraso** (ex.: reserva "no-show" após 15 min).
- **Tamanho mín./máx. de grupo por reserva**.
- **Mesas físicas do salão** (número + capacidade + zona). Já existe `numero_mesa` implicitamente via `comanda_ativa`; agora ganha tabela própria `mesas_fisicas` para capacidade e mapa.

Novo interruptor **Admin → Empresa → Configurações gerais**:

- `pedido_na_mesa_pelo_cliente` (bool, default `true`). Quando `false`:
  - O PWA na rota `/mesa` mostra cardápio + botão "Chamar garçom" mas oculta "Enviar para cozinha" e o carrinho.
  - `enviar_pedido_mesa` passa a checar esse flag e recusar (`PEDIDO_MESA_DESABILITADO`).

---

## Parte 2 — Reserva pelo PWA do cliente

Novo fluxo público autenticado em `/reservar`:

1. Cliente escolhe **data**, **nº de pessoas** e vê **horários com vagas** (consulta RPC `reserva_disponibilidade(data, pessoas)` que calcula `capacidade_do_horario - soma(pessoas das reservas confirmadas no mesmo slot)`).
2. Confirma dados (nome, WhatsApp, e-mail se logado). Se não estiver logado, cria conta via OTP como já fazemos.
3. Reserva entra como `status = 'confirmada'`. Cliente recebe push + WhatsApp com resumo e link "Ver minha reserva".
4. Cliente pode **cancelar** até X horas antes (regra da empresa).

Nova tabela `reservas` (`id, empresa_id, cliente_id, data, hora, pessoas, status, mesa_id (nullable até dar entrada), observacoes, created_at`). RLS: cliente vê as próprias; staff da empresa vê todas.

---

## Parte 3 — App do Garçom / Tap: aba **Recepção**

Guarda-chuva para a recepcionista (nova permissão `pode_recepcao`; garçom comum não vê):

- **Reservas do dia** — lista por horário. Botão **"Dar entrada"** abre modal para escolher a mesa física livre → cria `comanda_ativa` já vinculada ao cliente e dispara a notificação de "mesa aguardando atendimento" para os garçons da zona.
- **Fila de espera (walk-in)** — botão "Adicionar à fila" (nome + telefone + tamanho do grupo). Sistema gera posição. Botão **"Avisar mesa liberou"** → WhatsApp/SMS via provedor já integrado + push se o cliente estiver no PWA.
- **Mapa do salão** — lista/grade de mesas físicas com status (livre / ocupada / reservada às 20h). Arrastar um item da fila/reserva para uma mesa livre = abrir comanda naquela mesa.
- **Notificação para garçons**: quando a recepcionista abre a mesa, entra na fila de "Visto" que já existe no Caixa e também vira push para o garçom responsável pela zona.

Nova tabela `fila_espera` (`id, empresa_id, nome, telefone, pessoas, status ['aguardando','avisado','sentado','desistiu'], posicao, created_at, avisado_at`).

---

## Parte 4 — Integração com o que já existe

- **Comanda / mesa**: `comanda_ativa` ganha coluna opcional `reserva_id` e `fila_id` para rastrear origem.
- **Notificações**: reaproveita `NotifyClient` (push + WhatsApp) para lembrete de reserva (T-2 h), "mesa pronta" da fila, e alerta de garçom.
- **Permissões**: nova flag `pode_recepcao` em `permissoes_matriz`; abas Reservas/Fila/Mapa gated por ela.
- **QR da mesa**: continua igual; muda só o comportamento quando `pedido_na_mesa_pelo_cliente = false`.

---

## Detalhes técnicos

- Migração: `mesas_fisicas`, `reservas`, `fila_espera`, `config_reservas` (matriz de capacidade por dia da semana + horário); coluna `pedido_na_mesa_pelo_cliente` em `empresas`; coluna `pode_recepcao` em `permissoes_matriz`; coluna `reserva_id`/`fila_id` em `comanda_ativa`. Cada tabela pública com `GRANT` + RLS por `empresa_id` (ver regras do projeto).
- RPCs: `reserva_disponibilidade`, `criar_reserva`, `cancelar_reserva`, `dar_entrada_reserva(reserva_id, mesa_id)`, `fila_adicionar`, `fila_avisar`, `fila_sentar(fila_id, mesa_id)`.
- Endpoints Tap (`/api/public/tap/*`): `reservas`, `fila`, `mesas-livres`, `abrir-mesa` — todos autenticados pelo `deviceToken` já usado no Tap.
- `enviar_pedido_mesa` passa a validar `empresas.pedido_na_mesa_pelo_cliente`.
- Front: nova rota `/reservar` (PWA cliente), nova rota/aba **Recepção** no `/caixa` e no app Tap, aba **Reservas & Sala** no `/admin`.

---

## Perguntas antes de eu implementar

1. **Granularidade do horário de reserva**: slots fixos de **30 min**, **1 h**, ou configurável por empresa?
2. **Duração média da reserva** (para calcular ocupação futura): usar valor fixo por empresa (ex.: 90 min) ou perguntar em cada reserva?
3. **Depósito/sinal**: alguma reserva vai exigir pagamento antecipado (integração com Mercado Pago), ou por enquanto todas gratuitas?
4. **Aviso da fila**: mando por **WhatsApp (Twilio)**, **push do PWA** ou **os dois** em paralelo quando o cliente tem conta e app instalado?
