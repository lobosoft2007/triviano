## Objetivo
Incluir a identificação do pedido em todas as notificações enviadas ao cliente (sino no PWA + push OS), para que ele saiba a qual pedido a mudança de status se refere quando tem vários pedidos em andamento.

## Identificador a exibir
Usar `#` + os 6 primeiros caracteres do `order.id` em maiúsculas (mesmo padrão já usado no `WhatsAppStatusButton` e nos cupons — consistência total entre canais). Quando o pedido tiver `senha_diaria`, priorizar `#<senha_diaria>` (padrão que já usamos no painel de fila de impressão).

## Mudanças

### 1. `src/lib/notifications.ts`
- Transformar `STATUS_NOTIFICATION_MESSAGES` de objeto estático em função `buildStatusNotification(status, orderLabel)` que devolve `{ titulo, mensagem }` com o rótulo do pedido embutido no título e no corpo.
  - Ex.: título `"Saiu para entrega — Pedido #A1B2C3"`, mensagem `"Seu pedido #A1B2C3 saiu! O entregador já está a caminho."`.
- Atualizar `notifyStatusChange(orderId, userId, status, orderLabel?)` para receber e usar o rótulo; quando não vier, derivar de `orderId` (fallback `#XXXXXX`).
- Atualizar `notifyOrderCanceled(orderId, userId, brand, orderLabel?)` para incluir o rótulo no título/mensagem.

### 2. Call sites
Passar o `orderLabel` (senha diária quando existir, senão fallback de id) nas chamadas:
- `src/components/caixa/NotifyClient.tsx` (troca de status no caixa).
- `src/components/caixa/StatusControl.tsx` se disparar notificação direta.
- Qualquer outro ponto que chame `notifyStatusChange` / `notifyOrderCanceled` (buscar no repo antes de editar).

### 3. Sem mudanças de schema
Nenhuma migration necessária — o dado já existe em `orders` (`id`, `senha_diaria`). Apenas formatação de texto.

## Fora do escopo
- WhatsApp fallback já inclui o número — não mexer.
- Notificações antigas já persistidas não serão reescritas (apenas novas terão o rótulo).
