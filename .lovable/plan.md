# Reativar Status Movimentável nos Pedidos de Delivery

## Por que sumiu?

Sinceramente, não tenho um registro em memória de uma decisão explícita de "remover status do delivery". Olhando o código, o que aconteceu foi:

- O componente `src/components/caixa/StatusControl.tsx` **continua existindo, completo e funcional** — inclusive já integrado com `notifyStatusChange` (push no app do cliente) e `cancelOrder` (com estorno de estoque).
- A infra no backend está viva: `orders.status_pedido`, `updateStatusPedido()`, `ESTEIRA_STATUSES` (Recebido → Em preparação → Aguardando entregador → Em entrega → Entregue → Finalizado), trigger de notificação, tudo intacto.
- O que aconteceu no /caixa foi uma **refatoração visual** (na virada para o layout compacto de 1 coluna com cards clicáveis + modal de detalhe): o `DeliveryColumn` passou a renderizar `CompactOrderRow`, cujo único botão visível hoje é "Imprimir". O `StatusControl` deixou de ser incluído nem no card compacto nem no `OrderCard` do modal de detalhe — foi um "esqueceram de reconectar" durante o redesign, não uma decisão de negócio.

Ou seja: a funcionalidade não foi desligada, só ficou órfã da UI. Reativar é rápido e seguro.

## O que fazer

### 1. Reconectar `StatusControl` no cartão de delivery
No `CompactOrderRow` (`src/routes/_authenticated/caixa.tsx`, ~L1132) mostrar o `StatusControl` (com bolinha colorida + select) **apenas para delivery**, na barra de ações inferior, ao lado do botão Imprimir. Fica assim:

```text
┌─────────────────────────────────────────┐
│ João Silva            R$ 78,00          │
│ #A1B2C3 · 19:42 · espera 12 min         │
│                                          │
│ 🟡 [Em preparação ▼]     [🖨 Imprimir]  │
└─────────────────────────────────────────┘
```

- Envolver o `StatusControl` num `<div onClick={e => e.stopPropagation()}>` para que trocar o status não abra o modal de detalhe.
- Passar `orderId`, `userId={order.user_id}`, `status={order.status_pedido}`.

### 2. Também mostrar no modal de detalhe (`OrderCard`)
No `OrderCard` (~L1624), incluir o `StatusControl` no topo do card (só para `tipo_atendimento === "Delivery"`), para que ao abrir o pedido em detalhe o operador consiga mudar status por ali também.

### 3. Confirmar comportamento do "Cancelado"
O `StatusControl` já trata Cancelado com `confirm()` + `cancelOrder()` (estorna estoque, notifica cliente). Sem mudança.

### 4. Nada muda em Mesa
O controle continua só em delivery (mesas têm outro fluxo — comanda ativa / finalizar e receber).

### 5. Sem migração de banco
`orders.status_pedido` já existe, `updateStatusPedido` já existe, `notifyStatusChange` já existe, RLS já cobre. É puramente UI.

## Detalhes técnicos

- **Arquivo único editado:** `src/routes/_authenticated/caixa.tsx`.
- **Imports novos:** `StatusControl` de `@/components/caixa/StatusControl`.
- **Escopo:** apenas o ramo Delivery (`order.tipo_atendimento === "Delivery"`); Mesas ficam como estão.
- **Sem alteração** em: `caixa.ts`, `notifications.ts`, `StatusControl.tsx`, schema, RLS, triggers.
- **Sem impacto no motor financeiro** (respeita `mem://constraints/motor-financeiro-protegido`).

## Confirma?
Se quiser, eu já implemento. Alguma preferência?
- (a) Mostrar o `StatusControl` **tanto no cartão compacto quanto no modal** (recomendado — operador troca sem abrir o modal).
- (b) Mostrar **só no modal de detalhe** (cartão compacto fica mais limpo).
