## Objetivo
Ajustar o gatilho de impressão para que:
- **Dinheiro, Fiado e Cartão na entrega (maquineta)**: cozinha recebe o cupom **assim que o cliente envia o pedido** no PWA.
- **PIX e Cartão online (checkout Mercado Pago)**: cozinha só recebe o cupom **após a confirmação do pagamento** (webhook).

## Como diferenciar os dois grupos
Sinal já existente: `orders.aguardando_pagamento`.
- PIX / cartão online: entra `true`, o webhook do Mercado Pago vira para `false`.
- Dinheiro / fiado / maquineta: entra já como `false`.

Cobre 100% dos casos hoje sem alterar `meios_pagamento` nem criar coluna nova.

## Mudanças

### 1. Trigger `trg_orders_enqueue_print` (única alteração de banco)
Reescrever para 4 caminhos disjuntos, todos protegidos contra re-entrada:

- **AFTER INSERT** — se `aguardando_pagamento = false` → enfileira imediato (dinheiro/fiado/maquineta) e marca `impresso_cozinha = true`.
- **AFTER UPDATE (a)** — operador do Caixa/Mesa clicou "Enviar p/ cozinha" (transição manual de `impresso_cozinha` false → true) → enfileira.
- **AFTER UPDATE (b)** — `aguardando_pagamento` passou de `true` → `false` (webhook aprovou PIX/cartão online) → enfileira e marca `impresso_cozinha = true`.
- **AFTER UPDATE (c)** — rede de segurança: `status` mudou para `paid`/`delivered` sem ter sido impresso → enfileira e marca.

### Anti-recursão
O `UPDATE public.orders SET impresso_cozinha = true` feito dentro da trigger dispararia a própria trigger e satisfaria o caminho (a), gerando **cupom duplicado**. Solução: primeira linha da função sai cedo quando `pg_trigger_depth() > 1`. Assim a chamada externa é atendida (depth = 1) e todas as re-entradas do próprio UPDATE (depth = 2) são ignoradas.

### 2. Nenhuma alteração no PWA/checkout
Fluxo do cliente continua igual. Só a hora em que o cupom sai da fila muda.

### 3. Sem impacto no roteamento
`enqueue_print_jobs` (roteamento por categoria + cupom completo do balcão) continua idêntico — só muda **quando** é chamado.

## Detalhes técnicos

```sql
CREATE OR REPLACE FUNCTION public.trg_orders_enqueue_print()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Guarda anti-recursão: ignora reentradas causadas pelo próprio UPDATE interno.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Dinheiro / Fiado / Cartão na entrega: imprime imediato
    IF COALESCE(NEW.aguardando_pagamento, false) = false
       AND COALESCE(NEW.impresso_cozinha, false) = false THEN
      PERFORM public.enqueue_print_jobs(NEW.id);
      UPDATE public.orders SET impresso_cozinha = true WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  -- (a) Comanda de mesa/Caixa: operador clicou "Enviar p/ cozinha"
  IF NEW.impresso_cozinha = true AND COALESCE(OLD.impresso_cozinha, false) = false THEN
    PERFORM public.enqueue_print_jobs(NEW.id);
    RETURN NEW;
  END IF;

  -- (b) PIX/Cartão online confirmado pelo webhook
  IF COALESCE(OLD.aguardando_pagamento, false) = true
     AND COALESCE(NEW.aguardando_pagamento, false) = false
     AND COALESCE(NEW.impresso_cozinha, false) = false THEN
    PERFORM public.enqueue_print_jobs(NEW.id);
    UPDATE public.orders SET impresso_cozinha = true WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- (c) Rede de segurança: chegou em paid/delivered sem ter impresso
  IF NEW.status IN ('paid','delivered')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(NEW.impresso_cozinha, false) = false THEN
    PERFORM public.enqueue_print_jobs(NEW.id);
    UPDATE public.orders SET impresso_cozinha = true WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
```

Reanexar em `AFTER INSERT OR UPDATE ON public.orders`.

## Validações pós-implementação
- Pedido PWA em dinheiro → **1** conjunto de jobs enfileirado no INSERT (sem duplicata do UPDATE interno).
- Pedido PWA em PIX → nada no INSERT; **1** conjunto quando o webhook zera `aguardando_pagamento`.
- Comanda de mesa → botão "Enviar p/ cozinha" continua imprimindo pelo caminho (a).
- Pedido do Caixa finalizado direto em "paid" → rede de segurança (c) garante 1 impressão.
- Nenhum cupom duplicado ao mudar `status` posteriormente (guarda `impresso_cozinha` já `true`).

## Fora do escopo
- Alterar UI, `meios_pagamento` ou `config_impressoras`.
- Flag por empresa para desligar a impressão antecipada (pode ser aberto depois se alguma franquia pedir).
