## Objetivo

Permitir que o dono da empresa **cadastre, edite, ative/desative e apague** meios de pagamento (Vale Alimentação, Vale Refeição, Ticket, PicPay, etc.), com o percentual de cashback configurável no mesmo lugar. Fiado já existe e já é configurável — apenas será destacado no aviso da tela.

## Onde

Aba **Admin → Configurações de Pagamento**, logo acima do bloco atual "Cashback por meio de pagamento".

## Escopo

### 1. Nova seção "Meios de Pagamento" (`MeiosPagamentoCrud.tsx`)

Lista em cartões, cada linha com:
- Nome (editável inline ou via dialog)
- Toggle **Ativo**
- Toggle **Exige maquineta** (usado hoje para cartões)
- Campo **% Cashback** (0–100, mesmo input do bloco atual)
- Botão **Salvar** por linha e botão **Excluir** (com confirmação)

Cabeçalho com botão **"+ Novo meio de pagamento"** abrindo dialog com: nome, exige maquineta, % cashback inicial, ativo.

Regras:
- Nome único por empresa (validação client + índice).
- **Não permitir excluir** meios "de sistema" (PIX, Dinheiro, Cashback, Fiado, Cartão de Crédito, Cartão de Débito) — apenas desativar. Meios criados pelo usuário podem ser excluídos se não tiverem uso em `pagamentos_pedido`.
- Ao excluir com histórico de uso: bloquear e sugerir desativar.

### 2. Helpers em `src/lib/caixa.ts`

Adicionar:
- `createMeioPagamento({ nome, exige_maquineta, percentual_cashback, ativo })`
- `updateMeioPagamento(id, patch)` (nome + flags, além do cashback já existente)
- `deleteMeioPagamento(id)` — chama nova RPC `delete_meio_pagamento` que valida sistema/uso.

O `updateMeioCashback` atual continua funcionando (compat com o bloco de cashback).

### 3. Migração de banco

- `meios_pagamento`: adicionar coluna `is_sistema boolean not null default false` e marcar como `true` os 6 meios padrão existentes.
- Índice único `(empresa_id, lower(nome))`.
- Trigger no `insert` de novos meios: `empresa_id` = `current_empresa_id()` (padrão já usado no projeto), `is_sistema = false`.
- RPC `delete_meio_pagamento(p_id uuid)` (security definer): valida `can_manage_empresa`, rejeita se `is_sistema` ou se existir referência em `pagamentos_pedido`/`contas_financeiras.id_meio_pagamento`. Sem essas travas, uma exclusão quebraria relatórios e conciliação.
- Políticas RLS: manter SELECT como está; adicionar INSERT/UPDATE/DELETE para admins da empresa via `can_manage_empresa(empresa_id)` (padrão já usado nas outras tabelas). GRANTs conforme padrão do projeto.

### 4. Bloco "Cashback por meio de pagamento" existente

- Mantido como está — passa a listar automaticamente os meios novos.
- Adicionar uma linha de aviso curto: *"Fiado também é configurável. Cashback sobre fiado é creditado apenas quando o pedido é quitado."* (só texto, sem mudança de motor).

## Fora do escopo (não mexer)

- Motor de cashback (`award_order_cashback`), motor de fiado, `finalize_order_paid`, PIX, webhook MP, RLS financeira — protegidos por `mem://constraints/motor-financeiro-protegido`.
- Nada muda no fluxo do Caixa: os novos meios aparecem automaticamente na tela de pagamento (que já lê `fetchMeiosPagamento(true)`).
- Sem sincronização com Mercado Pago / adquirente — meio novo é apenas registro contábil interno.

## Entregáveis

1. Migração SQL (`is_sistema`, índice, RPC `delete_meio_pagamento`, políticas, GRANTs).
2. `src/lib/caixa.ts`: 3 novos helpers.
3. `src/components/admin/MeiosPagamentoCrud.tsx` (novo).
4. `src/components/admin/PaymentConfigTab.tsx`: montar o CRUD acima do bloco de cashback + aviso sobre Fiado.
