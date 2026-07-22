## Causa

Na RPC `public.abater_fiado_com_cashback` os nomes das colunas de saída (`saldo_cashback`, `saldo_devedor`) colidem com colunas de tabelas usadas no corpo (`profiles.saldo_cashback`, `profiles.saldo_devedor_fiado`). No `UPDATE ... RETURNING`, o Postgres vê `saldo_cashback` como ambíguo entre a coluna da tabela e a coluna OUT da função.

## Correção

Renomear as colunas de OUT para nomes que não conflitem e usá-las no `RETURN QUERY`:

```sql
CREATE OR REPLACE FUNCTION public.abater_fiado_com_cashback(
  p_user_id uuid, p_valor numeric DEFAULT NULL
)
RETURNS TABLE(
  out_saldo_cashback numeric,
  out_saldo_devedor numeric,
  out_abatido numeric
) ...
-- corpo idêntico ao atual
RETURN QUERY SELECT v_novo_cash, v_novo_debt, v_use;
```

O frontend usa `res.abatido` e `res.saldo_devedor` (via `abaterFiadoComCashback` em `src/lib/fiado.ts` — vou reler antes de alterar). Se ele depende dos nomes atuais, ajusto para aliasar no `SELECT` de retorno preservando a shape:

```sql
RETURN QUERY SELECT
  v_novo_cash AS saldo_cashback,
  v_novo_debt AS saldo_devedor,
  v_use       AS abatido;
```
— mantendo os nomes de saída via alias no `SELECT` (não na assinatura `RETURNS TABLE`), o que evita a ambiguidade. Vou usar essa forma para não mexer no cliente.

## Verificação
- Rodar novamente "Abater com cashback" no Caixa: retorno correto, saldo cai, sem erro de ambiguidade.
- Cliente comum abatendo o próprio saldo no PWA: continua funcionando.
