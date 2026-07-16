## Objetivo
No modo **Mesas** do Caixa, enxugar o card de cada rodada e mover a notificação do cliente para o nível da comanda inteira.

## Mudanças (apenas UI/composição — sem lógica financeira)

Arquivo único: `src/routes/_authenticated/caixa.tsx`.

### 1. `OrderCard` vira consciente do contexto
Adicionar prop opcional `variant?: "delivery" | "mesa"` (default `"delivery"`).

Quando `variant === "mesa"`, o `OrderCard` **não renderiza**:
- `<OrderActions />` na parte de baixo é substituído por só o botão **Editar** (sem o "Pagamento", já que o pagamento é unificado por comanda via "Finalizar e Receber").
- `<WhatsAppStatusButton />`
- `<NotifyClient />`

Delivery continua idêntico (todos os blocos presentes).

Implementação: extrair o botão "Pagamento" do `OrderActions` para que ele receba um flag `showPayment` (ou dividir em dois botões independentes dentro do `OrderCard`, mantendo Editar sempre e Pagamento só em delivery).

### 2. No diálogo de detalhe da mesa (por volta da linha 1565)
Depois do `.map` que renderiza os `OrderCard variant="mesa"` e antes/depois do bloco "Total da mesa + Imprimir conta + Finalizar e Receber", adicionar **uma única vez**:

```
<WhatsAppStatusButton order={ultimoPedido} />
<NotifyClient order={ultimoPedido} />
```

`ultimoPedido` = `group.orders[group.orders.length - 1]` (o mais recente da comanda — carrega `user_id`/`phone` necessários; ambos os componentes já buscam o profile pelo `user_id`, então qualquer pedido serve).

Colocar os dois logo antes do botão "Finalizar e Receber" para deixar o fluxo: conferência → notificar → cobrar.

### 3. `NotifyClient` — remover botão WhatsApp interno
Em `src/components/caixa/NotifyClient.tsx`:
- Remover o botão "WhatsApp" e a função `handleWhatsApp` (o WhatsApp fica só no `WhatsAppStatusButton` acima).
- O botão "Enviar pelo App" passa a ocupar 100% da largura (`w-full` no lugar de `flex-1`, e remover o wrapper `flex gap-2`).

Como `NotifyClient` também é usado no card de delivery, essa mudança afeta os dois modos — o que é desejável: no delivery já existe o `WhatsAppStatusButton` logo acima, então o botão WhatsApp interno era redundante em ambos os contextos.

## Fora do escopo
- Sem alterar `ComandaPaymentDialog`, RPCs, ou o `WhatsAppStatusButton`.
- Sem mudar o card de delivery (só perde o WhatsApp duplicado dentro do `NotifyClient`, que é ganho de UX).

## Validação
- Abrir uma mesa com 2+ rodadas: cada card deve mostrar só itens + Editar; um único bloco "Avisar via WhatsApp" + "Notificar cliente" aparece antes de "Finalizar e Receber".
- Delivery: card continua com Editar + Pagamento, WhatsApp e Notificar (sem botão WhatsApp duplicado dentro do quadro Notificar).