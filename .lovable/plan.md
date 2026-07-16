## Regra de vida atual das notificações (sino do PWA)

- **Origem**: `notificacoes_cliente`, inseridas pelo Caixa a cada mudança de status do pedido e pelo gatilho de cashback.
- **Filtro por tenant**: só notificações de pedidos da empresa do host atual.
- **Janela visível**: últimas 24h (banco continua guardando o histórico para auditoria).
- **Limite**: 50 registros, mais recentes primeiro.
- **Lidas/não lidas**: badge conta só `lida=false`. Abrir o sino marca todas as visíveis como lidas.
- **Realtime**: Supabase Realtime + banner nativo quando permitido.
- **Hoje não há forma de esconder** — some sozinho depois de 24h.

## O que muda

1. **Ocultar sem apagar** (per-device, sem tocar no banco).
2. **Scroll vertical** dentro do popover, tanto no celular quanto no desktop, para ver todas as notificações do dia.

## Passos

### 1. Ocultar visualmente (sem apagar do banco)

- Novo helper `src/lib/hiddenNotifications.ts`:
  - `getHiddenIds(userId)` — lê `localStorage["hidden-notifications:<userId>"]` e purga IDs com timestamp > 24h.
  - `hideNotification(userId, id)` / `hideAll(userId, ids)` — grava `{id, ts}` no mapa.
- `src/hooks/useNotifications.ts`:
  - Estado `hiddenIds` (Set) inicializado por `getHiddenIds`.
  - Filtra `notifications` removendo IDs ocultos; recalcula `unreadCount`.
  - Expõe `hideOne(id)` e `hideAll()`.
- `src/components/NotificationBell.tsx`:
  - Botão discreto `EyeOff` à direita de cada item → `hideOne(n.id)` com `stopPropagation`.
  - Botão "Ocultar todas" no cabeçalho ao lado de "Marcar todas".
  - Sem confirmação, sem toast — ação silenciosa (o registro fica no banco para auditoria).

### 2. Scroll vertical no popover (mobile + desktop)

- No `PopoverContent` do sino, aplicar altura máxima responsiva e overflow vertical apenas na lista:
  - Wrapper da lista: `max-h-[70vh] sm:max-h-96 overflow-y-auto overscroll-contain`.
  - Manter o cabeçalho ("X notificações" + "Marcar todas" + "Ocultar todas") **fora** do container rolável, para ele ficar sempre visível enquanto a lista rola.
  - Rodapé (se houver) também fica fixo, fora do scroll.
- Garantir que o `PopoverContent` em si não corte a lista: usar `p-0` no conteúdo e aplicar o padding só nos filhos, para o scroll ocupar toda a altura disponível.
- No mobile o popover já é ancorado ao ícone; a altura `70vh` é suficiente para ver muito mais que 4 itens sem invadir o restante da tela.

## Fora do escopo

- Nenhuma alteração de banco, RLS, motor financeiro, push nativo, WhatsApp ou realtime.
- Não sincronizo o "oculto" entre dispositivos (é intencional).
- Não altero a janela de 24h nem o motor de inserção pelo Caixa.
