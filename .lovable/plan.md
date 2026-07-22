## Diagnóstico

Confirmei o que você observou. A Claudia (admin) está recebendo notificações de pedidos de OUTROS clientes por causa da política RLS de leitura da tabela `notificacoes_cliente`:

```
SELECT policy: (id_usuario = auth.uid()) OR can_manage_empresa(user_empresa_id(id_usuario))
```

Ou seja: qualquer admin da empresa pode LER todas as notificações dos clientes da empresa. Combinado com o fato de que `fetchMyNotifications` (em `src/lib/notifications.ts`, L231) **não filtra por `id_usuario`** — confia só na RLS — o sino da Claudia mostra as notificações de todos os clientes.

Dois detalhes que confirmam o comportamento relatado:

- Pedido da Claudia (admin) → gera 1 linha com `id_usuario = claudia`. Ela vê no sino dela. Ninguém mais é admin com auth.uid = claudia, então mais ninguém recebe. ✅
- Pedido do Marcello (cliente) → gera 1 linha com `id_usuario = marcello`. Marcello vê pela cláusula `id_usuario = auth.uid()`. Claudia vê pela cláusula `can_manage_empresa(...)`, porque ela é admin da mesma empresa. ❌

O disparo é 1 só (`insertNotification` em `src/lib/notifications.ts` L164) — não há duplicação no envio. O "vazamento" acontece **na leitura**.

Observação: o canal realtime já filtra por `id_usuario=eq.${user.id}` (`src/hooks/useNotifications.ts` L57/L73), então em tempo real a Claudia não recebe push instantâneo dos outros. Mas assim que ela abre/recarrega o app, o fetch inicial traz todas via RLS.

## Correção proposta (mínima e cirúrgica)

Notificações de pedido são **pessoais do cliente** — o operador vê o status do pedido na tela do Caixa, não precisa do sininho do cliente. Vou restringir a leitura para "só o próprio dono".

### 1. Frontend — `src/lib/notifications.ts` (`fetchMyNotifications`)
Adicionar filtro explícito `.eq("id_usuario", <auth user id>)`. Assinatura passa a receber `userId` além de `empresaId`. Ajustar chamada em `src/hooks/useNotifications.ts` para passar `user.id`.

Isso já resolve 100% o sintoma no PWA sem depender de migração.

### 2. Backend (defesa em profundidade) — migração RLS
Alterar a policy `Clients read own notifications` removendo o ramo `can_manage_empresa(...)`, deixando apenas `id_usuario = auth.uid()`. Admin não precisa ler notificações alheias — se algum dia for necessário um painel de "avisos enviados", isso vira uma view/RPC dedicada.

As demais policies (INSERT/UPDATE/DELETE por admin da empresa) ficam intactas — o Caixa continua conseguindo criar/apagar notificações para clientes.

## Escopo do que NÃO muda

- Nada no fluxo de disparo (`notifyStatusChange`, `insertNotification`, gatilhos de cashback etc.).
- Nada no realtime.
- Nada na UI do sino ou do Caixa.
- Notificações da Claudia como cliente (pedidos dela) continuam chegando normalmente.

## Verificação após aplicar

1. Logar como admin (Claudia) sem pedidos próprios pendentes → sino vazio.
2. Fazer um pedido como Marcello → só Marcello recebe.
3. Claudia faz um pedido como cliente dela mesma → Claudia recebe.
