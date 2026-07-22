## Causa raiz (confirmada nos logs + banco)

O webhook do Mercado Pago chegou, foi reconciliado com sucesso (`mpStatus: processed`, `paidAmount: 34`) e invocou `pay_fiado_from_mp`. Essa função é `SECURITY DEFINER`, mas por baixo ela chama `public.pay_fiado(...)`, que começa com:

```sql
IF NOT public.has_role(auth.uid(), 'admin') THEN
  RAISE EXCEPTION 'Acesso restrito.';
END IF;
```

Como o webhook roda sem sessão (`auth.uid()` é NULL), a chamada falha com **"Acesso restrito."** — exatamente a mensagem que aparece nos logs `mp-webhook: pay_fiado_from_mp falhou`. Resultado: o MP confirma o pagamento, mas o saldo devedor não é baixado.

## Correção proposta

Reescrever `public.pay_fiado_from_mp` para **não depender de `pay_fiado`** e executar a baixa diretamente (função continua `SECURITY DEFINER`, protegida por só ser chamada com um `charge_id` válido da tabela `mp_fiado_charges`, cujo status/empresa já são conferidos internamente).

A nova versão faz, dentro da mesma transação e de forma idempotente (retorna cedo se `status='paid'`):

1. `SELECT ... FOR UPDATE` da cobrança em `mp_fiado_charges`.
2. `UPDATE profiles.saldo_devedor_fiado = GREATEST(0, saldo - valor)` do `user_id` da cobrança.
3. `INSERT` em `extrato_fiado` (tipo `Credito_Pagamento`) — histórico do fiado.
4. `INSERT` em `extrato_conta_corrente` (tipo `Credito`, descrição "Quitação PIX Mercado Pago").
5. `UPDATE clientes_fiado.saldo_devedor_atual` para refletir o novo saldo.
6. `PERFORM notify_fiado(...)` para notificar o cliente.
7. Marca a cobrança como `paid`, grava `paid_at` e `mp_payment_id`.

Diferenças frente ao `pay_fiado` tradicional (intencionais para o contexto webhook):
- **Sem `has_role`/`can_manage_empresa`**: quem autoriza é o próprio Mercado Pago via `mp_fiado_charges` (a cobrança só existe porque o cliente autenticado a criou pela Edge Function, com validação de `empresa_id` e `saldo_devedor_fiado`).
- **Não lança em `movimentacoes_caixa`**: pagamento veio online, fora de qualquer caixa aberto — coerente com o comportamento já usado pelo webhook em outros fluxos MP.

Nenhuma outra função, RLS, GRANT ou trigger é alterada. O Edge Function `mp-webhook` já chama a RPC do jeito certo; só a função SQL precisa mudar.

## Entregável

- Uma migração SQL única redefinindo `public.pay_fiado_from_mp(uuid, text)` conforme acima.
- Sem mudanças de código no front nem nas Edge Functions.

## Validação após aplicar

1. Refazer um pagamento PIX de fiado pelo `/perfil`.
2. Conferir nos logs do `mp-webhook` a ausência de `pay_fiado_from_mp falhou`.
3. Ver o saldo devedor cair no `/perfil` (dialog fecha sozinho via polling) e a linha aparecer em "Extrato".
