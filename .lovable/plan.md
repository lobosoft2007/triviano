# Blueprint Técnico — Módulo de Experiência de Mesa (v1.5.0)

Este é o **plano lógico** (sem código). A arquitetura reaproveita o que já existe: `orders`/`order_items` (com `tipo_atendimento='Presencial'` e `numero_mesa`), o dispatch de impressão por setor (`makeSectorResolver` + `dispatchPreparation`), o Realtime já ligado em `orders`/`notificacoes_cliente`, e o resolvedor de tenant por host (`resolve_empresa_id_by_host`).

## 1. Esquema de Banco de Dados

### `solicitacoes_mesa` (o "pedido de abertura" antes do Visto)
```text
id              uuid  PK
empresa_id      uuid  FK empresas   (tenant — isolamento)
numero_mesa     int                 (lido do QR-Code)
nome_cliente    text
telefone        text
user_id         uuid  FK auth.users (após OTP)
status          enum solicitacao_status  DEFAULT 'aguardando'
                  ('aguardando','liberada','recusada','expirada')
host_origem     text                (host que originou — auditoria anti-fraude)
liberada_por    uuid                (operador que deu o Visto)
liberada_em     timestamptz
created_at / updated_at
```
GRANT: `authenticated` (o cliente cria/lê a própria; operador gerencia via `can_manage_empresa`). RLS: cliente lê/insere onde `user_id = auth.uid()`; operador lê/atualiza onde `can_manage_empresa(empresa_id)`.

### `comanda_ativa` (a conta aberta da mesa após liberação)
```text
id              uuid  PK
empresa_id      uuid  FK empresas
numero_mesa     int
solicitacao_id  uuid  FK solicitacoes_mesa
user_id         uuid  FK auth.users
nome_cliente    text
status          enum comanda_status  DEFAULT 'aberta'
                  ('aberta','aguardando_fechamento','fechada','cancelada')
total_parcial   numeric  DEFAULT 0   (recalculado por trigger a cada pedido)
fechada_em      timestamptz
created_at / updated_at
```
GRANT/RLS iguais (cliente dono + operador do tenant). `orders` ganha coluna opcional `comanda_id uuid` para vincular cada "envio para cozinha" à comanda; o total_parcial soma os `orders` daquela comanda que não estão cancelados (trigger em `orders`).

> Decisão: cada "Enviar para a cozinha" cria **um `order` normal** (`tipo_atendimento='Presencial'`, `numero_mesa`, `comanda_id`), reaproveitando 100% do dispatch de impressão e da esteira de status do Caixa. A `comanda_ativa` é o agregador da sessão da mesa.

### Realtime
`ALTER PUBLICATION supabase_realtime ADD TABLE solicitacoes_mesa, comanda_ativa;` (orders já está publicado).

## 2. Sincronia Realtime

**Visto de abertura (Caixa ← cliente):**
1. Cliente lê QR → OTP → `INSERT solicitacoes_mesa(status='aguardando')`.
2. Cockpit do Caixa assina `postgres_changes` em `solicitacoes_mesa` (filtro `empresa_id`). Nova linha `aguardando` → aparece um card/toast "Mesa X quer abrir" com botão **Liberar / Recusar**.
3. Celular do cliente assina a **própria** solicitação (`id=eq`). Enquanto `aguardando`: spinner + "Aguardando liberação do Caixa..." + botão **Desistir** (marca `recusada`/`expirada`).
4. Operador clica Liberar → RPC `liberar_mesa` (SECURITY DEFINER): valida `can_manage_empresa`, seta `status='liberada'`, cria `comanda_ativa(status='aberta')`. O Realtime empurra o evento ao celular → cardápio desbloqueia.

**Fechamento (Caixa ← cliente):**
1. Cliente em "Minha Comanda" clica **Fechar a conta e pagar** → RPC seta `comanda_ativa.status='aguardando_fechamento'`.
2. Caixa assina `comanda_ativa`; ao ver `aguardando_fechamento` aplica **destaque Amarelo Pulsante** no card da mesa + dispara impressão automática da conta (reusa `printBill`).
3. Cliente vê: *"O garçom já está a caminho com a conta e a maquininha. Obrigado pela visita!"*.
4. Operador finaliza pagamento (fluxo atual) → `comanda_ativa.status='fechada'`.

Padrão de assinatura: canal criado dentro de `useEffect`, `removeChannel` no cleanup (regra já usada no projeto), filtrando sempre por `empresa_id`.

## 3. Segurança — impedir abertura remota

Camadas combinadas (defesa em profundidade):
1. **Validação de Host (obrigatória):** a solicitação só é aceita quando o host resolve para o tenant correto via `resolve_empresa_id_by_host`. O `host_origem` é gravado e a RPC de liberação rejeita hosts inconsistentes. O fluxo de mesa é habilitado apenas no **escopo delivery/tenant do cliente**, nunca em holding/superadmin.
2. **QR-Code assinado por mesa:** o QR não carrega só o número — carrega um token curto (HMAC do `empresa_id`+`numero_mesa`) validado no servidor, evitando "chutar" números de mesa.
3. **Geofencing opcional (flag por empresa):** ao ler o QR, o app pede geolocalização e a RPC compara com o `lat/long` da empresa (já temos endereço/CEP; adicionamos coordenadas). Fora do raio configurável → bloqueia. Fica atrás de um switch `mesa_exige_geofence` em `empresas` para lojas que não quiserem fricção.
4. **Visto humano:** nada libera cardápio sem o operador aprovar — é o freio final contra qualquer abertura remota.

## 4. Frontend (fluxos de UI)

- **Bifurcação na home (`src/routes/index.tsx`):** no escopo delivery, dois cards — `🛵 DELIVERY` e `🪑 CONSUMIR NA MESA` — no lugar do atalho atual de entrada.
- **Fluxo Mesa (novo `/mesa`):** Nome+Telefone → OTP (reusa `signInWithOtp`/`verifyOtp`) → leitura de QR (câmera) → tela de espera → cardápio liberado.
- **Carrinho em modo mesa (`src/lib/cart.tsx` + `CartSheet`):** botão vira `🍳 ENVIAR PEDIDO PARA A COZINHA`; ao enviar cria o `order` vinculado à comanda, dispara impressão automática por setor e limpa o carrinho local (mantém a comanda no servidor).
- **Tela "Minha Comanda":** histórico dos envios + total parcial (lido de `comanda_ativa`) + botão `🏁 FECHAR A CONTA E PAGAR`.
- **Caixa (`caixa.tsx`):** nova fila de solicitações pendentes (Visto) + destaque amarelo pulsante para comandas em `aguardando_fechamento`, integrado ao grid de Mesas atual.

## 5. Preservação (sem regressão) — motor protegido
Conforme `mem://constraints/motor-financeiro-protegido`: **não** alteramos triggers/RPCs financeiras, RLS/GRANT existentes, `meios_pagamento`, webhook MP nem a trava do PIX. Só **adicionamos** tabelas/colunas novas e novas RPCs isoladas. Impressão reusa o dispatch atual. `src/lib/version.ts` → `1.5.0` ao concluir.

## 6. Ordem de execução (quando aprovado)
1. Migração: enums, `solicitacoes_mesa`, `comanda_ativa`, coluna `orders.comanda_id`, RPCs (`liberar_mesa`, `abrir_solicitacao_mesa`, `fechar_comanda`), triggers de total, GRANT+RLS, Realtime.
2. Segurança do QR (token HMAC) + flag/coords de geofence em `empresas`.
3. Home: bifurcação Delivery / Mesa.
4. Rota `/mesa`: OTP + leitura QR + tela de espera (Realtime).
5. Carrinho modo mesa + envio para cozinha (impressão automática).
6. Tela "Minha Comanda" + fechar conta.
7. Caixa: fila de Visto + destaque amarelo pulsante + impressão da conta.
8. `version.ts` → 1.5.0, typecheck e deploy no Preview.

## Decisões que preciso confirmar
- **Leitura de QR:** usar biblioteca JS de câmera no navegador (ex.: `@zxing/browser`) — ok adicionar dependência?
- **Geofencing:** entra já na v1.5.0 (atrás de flag) ou fica para depois, mantendo só a validação de host + QR assinado?
- **OTP por WhatsApp:** o OTP atual é por e-mail; confirmar se manteremos e-mail/SMS nativo do Cloud ou se há gateway de WhatsApp já contratado.
