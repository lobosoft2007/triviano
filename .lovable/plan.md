# Repetir Pedido — Plano corrigido (Backend RPC + Frontend)

## Arquitetura escolhida
- **Backend = função SQL RPC `SECURITY DEFINER`** (não Edge Function). Motivo: a lógica de preço já vive no `create_order` (SQL). Uma RPC reaproveita a **mesma** fórmula (tamanho, meia-a-meia, açaí/adicionais grátis, adicionais pagos), evitando divergência entre o preço mostrado no carrinho e o cobrado no checkout. Edge Function neste projeto é só para webhooks externos.
- **Frontend** chama a RPC, recebe os itens já validados e reprecificados, preenche o carrinho e **para no cardápio** (não vai ao checkout).

## PARTE 1 — Migração SQL: `public.repeat_order(p_order_id uuid, p_host text)`

Retorna `jsonb` com a forma:
```json
{
  "eligible": true,
  "total_items": 5,
  "available_items": 4,
  "skipped_items": 1,
  "items": [
    {
      "product_id": "...", "product_name": "...", "display_name": "...",
      "category_slug": "pizzas", "combo_role": "",
      "size": "Grande", "second_flavor": "",
      "addons": [{ "name": "Borda", "price": 8.0, "quantity": 1 }],
      "remocoes": ["Cebola"],
      "unit_price": 59.9,
      "image_url": "empresa/uuid/arq.jpg",
      "quantity": 2
    }
  ]
}
```

Lógica (SECURITY DEFINER, `search_path = public`):
1. **Auth/propriedade**: `v_user := auth.uid()`; exige que o pedido seja do próprio usuário (`orders.user_id = v_user`) ou admin. Senão exceção.
2. **Elegibilidade**: rejeita rascunho/não pago — bloqueia quando `status IN ('rascunho_pagamento','pagamento_abandonado')` OU (`aguardando_pagamento = true` AND `pago_online = false`). Isso já cobre a regra: entregues/recebidos/cancelados ✅, rascunho ❌. Se inelegível → retorna `{"eligible": false}`.
3. **Reconciliação por item** (loop em `order_items` do pedido):
   - Busca o produto atual: `products p JOIN categories c` onde `p.id = oi.product_id AND p.available = true AND p.empresa_id = <empresa do pedido>`. Se **não achar** → conta como `skipped` e pula.
   - **Recalcula `unit_price` reusando a fórmula do `create_order`**:
     - `base` = `produtos_price_options.preco` do `size`; se nulo, `products.price`.
     - Meia-a-meia: se `allows_half` e `second_flavor` existe e o 2º sabor **ainda existe** no cardápio → `base = round((base + base2)/2, 2)`; se o 2º sabor sumiu → degrada para sabor único.
     - Açaí (`free_addon_limit > 0` + free_addons): recalcula excedente de grátis + adicionais premium.
     - Adicionais pagos: soma `produtos_addons.preco` **atual** por nome; adicional que não existe mais é descartado.
   - Monta o `display_name` (½ A / ½ B, ou "Nome (Tamanho)", ou "Nome") igual ao `create_order`.
   - Reprecifica cada addon retornado com o preço atual (para o carrinho exibir certo).
   - Acrescenta ao array `items` com `category_slug`, `combo_role`, `image_url` (caminho bruto), `remocoes`, `quantity`.
4. Retorna o `jsonb` com contagens (`total_items`, `available_items`, `skipped_items`).

GRANT: `GRANT EXECUTE ON FUNCTION public.repeat_order(uuid, text) TO authenticated;`

## PARTE 2 — Frontend

### `src/lib/orders.ts` (editar)
- Adicionar `REORDERABLE_STATUSES` (lista de status elegíveis para exibir o botão) e um helper `isReorderable(status)`.
- Adicionar `repeatOrder(orderId): Promise<RepeatOrderResult>` que chama `supabase.rpc("repeat_order", { p_order_id, p_host: currentHost() })` e tipa o retorno (`eligible`, contagens, `items`).

### `src/routes/_authenticated/orders.tsx` (editar)
- Importar `useCart`, `useNavigate`, `resolveImageUrls`, `toast`, ícone `RotateCcw`.
- Botão **"Repetir pedido"** no rodapé de cada `<article>`, visível só quando `isReorderable(order.status)`.
- Handler `handleReorder(order)`:
  1. Chama `repeatOrder(order.id)` (com estado de loading no botão).
  2. `eligible === false` ou `items.length === 0` → `toast.error("Nenhum item deste pedido está disponível no momento.")`.
  3. Resolve as imagens dos itens (`resolveImageUrls`) e mapeia cada um para `NewCartItem` (mesma forma que o `ProductCustomizer` produz), chamando `addLine(item, quantity)`.
  4. Se `skipped_items > 0` → `toast.warning("N item(ns) fora do cardápio foram ignorados.")`; senão `toast.success("Itens adicionados ao carrinho!")`.
  5. `navigate({ to: "/" })` — **para aqui**. Cliente vê o carrinho montado e assume o fluxo (edita/adiciona/remove/confirma).
- Comportamento do carrinho: **acrescenta** aos itens atuais (linhas idênticas são mescladas por `makeLineId`). Não vai ao checkout.

## Fora de escopo (base 1.0.1 intacta)
- Nada muda em `create_order`, checkout, webhooks, combos ou RLS existente.
- Nenhuma Edge Function nova.

## Teste no Preview
1. Logar como cliente em "Meus pedidos".
2. "Repetir pedido" em um pedido entregue → carrinho preenchido com preços atuais, volta ao cardápio.
3. Confirmar que rascunhos/não pagos não mostram o botão.
4. (Opcional) Desativar/indisponibilizar um produto no admin e repetir um pedido que o continha → item pulado com aviso; se todos indisponíveis → aviso de impossibilidade.
