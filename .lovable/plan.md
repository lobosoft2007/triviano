# Cashback Dinâmico por Meio de Pagamento — v1.4.0

## Situação atual (o que muda)
Hoje o cashback é um **percentual único global** por empresa (`empresas.percentual_cashback`). A trigger `award_order_cashback` calcula `total × pct_global` quando o pedido vira `Finalizado`. Vamos trocar isso por **percentual por meio de pagamento**, calculado sobre o valor **efetivamente pago** em cada meio.

---

## 1. Banco de Dados

**a) Nova coluna** em `meios_pagamento`:
```
percentual_cashback  numeric  NOT NULL  DEFAULT 0
```
Mantém RLS e isolamento multi-tenant já existentes (`can_manage_empresa`).

**b) Novo valor no enum** `cashback_mov_tipo`: `'ajuste_admin'` (para créditos manuais do admin).

---

## 2. Motor de Cálculo (nova lógica da trigger `award_order_cashback`)

A trigger continua disparando quando `status_pedido → 'Finalizado'` (e mantém a proteção anti-duplicidade e o bloqueio de Fiado). A fórmula muda para **somar linha a linha** dos pagamentos reais do pedido:

```text
cashback_total = Σ  round( pagamentos_pedido.valor_pago
                           × meios_pagamento.percentual_cashback / 100 , 2 )
```
para cada linha em `pagamentos_pedido` do pedido, unindo com `meios_pagamento`.

Exemplo (pedido de R$100 pago R$60 PIX + R$40 Dinheiro):
```text
PIX      60,00 × 5% = 3,00
Dinheiro 40,00 × 2% = 0,80
--------------------------
Cashback total       = 3,80
```
- Usa o `valor_pago` (valor **líquido** que o cliente pagou em cada meio), então cashback já usado / descontos não geram bônus.
- Cartão a 0% → não gera cashback.
- Se `cashback_total ≤ 0`, não credita nada.
- Continua respeitando `empresas.cashback_ativo` (kill-switch) e o isolamento por `empresa_id` do pedido.
- Mantém os registros em `historico_cashback` e `extrato_cashback` (`credito_ganho`) + `notify_cashback`.

---

## 3. Interface Admin — Aba Pagamentos

Adicionar uma seção **"Cashback por meio de pagamento"** listando cada `meios_pagamento` ativo da empresa com um input de **% ao lado**:
- PIX Online → 5%
- Dinheiro → 2%
- Cartão (Crédito/Débito) → 0% (desativado)

Salvamento via `UPDATE meios_pagamento SET percentual_cashback` (RLS garante o tenant). Um helper `updateMeioCashback` em `src/lib/caixa.ts`.

---

## 4. UX do Cliente — Checkout

Ao selecionar a forma de pagamento, exibir frase de incentivo dinâmica:
> *"Pague com PIX e ganhe R$ 3,80 de volta!"*

- Busca os `percentual_cashback` dos meios (query leve por empresa).
- Calcula em tempo real: `finalTotal × pct(payMethod) / 100`.
- Só aparece quando o percentual do meio selecionado > 0 e `cashback_ativo`.
- Atualiza instantaneamente ao trocar de meio.

---

## 5. Preservação (sem regressão)
- Trava de segurança do PIX online (webhook/confirmação) intacta.
- Isolamento multi-tenant mantido em todas as consultas e na trigger.
- Bloqueio de cashback em pedidos Fiado mantido.

---

## 6-10. Crédito manual de Cashback (Admin → Conta Corrente do Cliente)

**Botão** `+ Adicionar Crédito Cashback` em cada `ClientRow` do `ContaCorrenteTab`, renderizado **apenas** no `mode="admin"` e para `is_admin_local` ou superior (checagem via `usePermissions().isManager`).

**Modal** pedindo:
- **Valor (R$)**
- **Motivo** (ex.: "Cortesia por atraso", "Bonificação VIP")

**RPC `admin_credit_cashback(p_cliente_id, p_valor, p_motivo)`** (`SECURITY DEFINER`):
1. Autoriza: `can_manage_empresa(empresa do cliente)` — senão erro.
2. `UPDATE profiles SET saldo_cashback = saldo_cashback + p_valor`.
3. `INSERT INTO extrato_cashback (... tipo_movimentacao='ajuste_admin', valor, saldo_residual, descricao/motivo ...)`.
   - Nota: `extrato_cashback` não tem coluna de descrição hoje — será adicionada uma coluna `descricao text` para guardar o motivo do ajuste.
4. Dispara `notify_cashback` para avisar o cliente.

Ao salvar → **toast**: `Crédito de R$ XX,XX aplicado com sucesso ao cliente`, e invalida `fiado-clients`.

`cashbackLabel()` em `src/lib/cashback.ts` ganha rótulo para `ajuste_admin` ("Crédito manual").

---

## Versionamento
`src/lib/version.ts` → `APP_VERSION = "1.4.0"`, `LAST_PATCH_DATE = "2026-07-13"`, e item novo no `STABLE_RELEASE.validated`.

---

## Ordem de execução
1. Migração: coluna `percentual_cashback`, enum `ajuste_admin`, coluna `descricao` em extrato, trigger reescrita, RPC `admin_credit_cashback`.
2. `src/lib/caixa.ts`: helpers de leitura/escrita de % + crédito manual.
3. Aba Pagamentos: UI de % por meio.
4. Checkout: frase de incentivo dinâmica.
5. ContaCorrenteTab: botão + modal de crédito manual (guarded).
6. `version.ts` → 1.4.0.
7. Typecheck e deploy no Preview.