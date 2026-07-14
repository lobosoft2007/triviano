## Corrigir status exibido em "Meus Pedidos"

**Diagnóstico:** o card usa `order.status` (enum interno em inglês: `pending`, `delivered`, `cancelled`) com um mapa que só cobre parte dos valores. A esteira real do pedido vive em `order.status_pedido` (`Recebido` → `Em preparo` → `Pronto` → `Finalizado` / `Cancelado`) e é a que o Caixa/KDS atualizam. Resultado atual:

- Delivery finalizado (`status=delivered`) → aparece como "Entregue" (não como "Finalizado").
- Mesa/Presencial finalizado também cai em "Entregue".
- "Cancelado" funciona por coincidência (`cancelled` está no mapa).
- Nenhum estado intermediário (Em preparo / Pronto / Saiu para entrega) reflete o que a cozinha marcou, então tudo que ainda não terminou parece "Recebido".

**Correção (só frontend, `src/routes/_authenticated/orders.tsx`):**

1. Substituir o mapa `statusLabels` por um baseado em `status_pedido`, com rótulo amigável por estado e sensível ao tipo de atendimento:
   - `Recebido` → "Pedido recebido"
   - `Em preparo` → "Em preparo"
   - `Pronto` → Mesa: "Pronto para servir" · Delivery: "Pronto para entrega"
   - `Saiu para entrega` → "Saiu para entrega"
   - `Finalizado` → Mesa: "Finalizado" · Delivery: "Entregue"
   - `Cancelado` → "Cancelado"
   - Fallback: usa o próprio `status_pedido`.
2. Definir a cor do chip pelo estado (`success` para Finalizado, `destructive` para Cancelado, `accent` para em andamento) em vez de sempre verde.
3. Trocar o ícone quando cancelado (`XCircle`) para não parecer sucesso.

Sem mudanças de backend — os dados já estão corretos em `status_pedido`, o problema é puramente de renderização.