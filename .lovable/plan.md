## Objetivo
No card **Conta Corrente** de `/perfil` (Meus Dados), adicionar um botão **"Pagar via PIX"** que gera cobrança dinâmica do Mercado Pago (mesma infra do checkout/comanda). O webhook confirma o pagamento e chama `pay_fiado` automaticamente, quitando o saldo devedor sem intervenção do caixa. O card de cashback já tem o botão de abatimento — mantido como está.

## UX no /perfil

Dentro da seção "Conta Corrente" (só aparece se `fiado_autorizado` e `saldo_devedor_fiado > 0`):

- Botão **"Pagar com PIX"** abaixo do bloco de saldo/limite.
- Ao clicar → abre um `Dialog` com:
  - Campo de **valor** (numérico, default = saldo devedor, min = R$ 0,01, max = saldo devedor).
  - Botão **"Gerar QR Code"**.
  - Após gerar: **QR (imagem base64)** + **Copia e Cola** com botão de copiar + valor formatado + indicador "Aguardando pagamento…".
  - Ao webhook confirmar (polling do status): toast de sucesso, dialog fecha, saldo devedor atualiza (invalidate das queries de perfil + extrato fiado + extrato cashback + full-profile).

Nenhuma mudança no card de cashback — o botão "Usar X para abater o fiado" já existe.

## Backend

### 1. `supabase/functions/mp-create-payment/index.ts`
Aceitar novo `kind: "fiado"` no payload:
- Sem `order_id`. Payload: `{ kind: "fiado", user_id, amount, host }`.
- Valida: `amount > 0`, `amount <= saldo_devedor_fiado` do `user_id`, `auth.uid() = user_id`.
- Resolve `empresa_id` via host e busca token MP secreto (mesmo fluxo atual).
- Cria Order MP PIX com `external_reference = "fiado:<user_id>:<uuid>"` e `metadata: { kind: "fiado", user_id, empresa_id, valor }`.
- Grava linha em nova tabela `mp_fiado_charges` (id, user_id, empresa_id, valor, mp_order_id, status, created_at) para o webhook conseguir localizar e para polling.
- Retorna `qr_code`, `qr_code_base64`, `mp_order_id`, `status`.

### 2. `supabase/functions/mp-webhook/index.ts`
No handler, após buscar a Order do MP, se `metadata.kind === "fiado"`:
- Localiza `mp_fiado_charges` pelo `mp_order_id`; se já `paid`, retorna 200 (idempotência).
- Se aprovado, chama nova RPC `pay_fiado_from_mp(p_user_id, p_valor, p_mp_order_id)` (SECURITY DEFINER) que:
  - Insere/garante meio de pagamento "PIX Mercado Pago" e chama a lógica de `pay_fiado` (mesmo caminho já existente), amarrando a origem ao `mp_order_id` no `descricao` do lançamento.
  - Marca `mp_fiado_charges.status = 'paid'`.
- Se recusado/expirado, marca `status = 'failed'`.

### 3. Nova RPC `get_mp_fiado_status(p_mp_order_id)`
Definer, retorna `{status}` da `mp_fiado_charges` para o polling do frontend (RLS: só o dono da linha lê).

### 4. Migração
- `CREATE TABLE public.mp_fiado_charges` com colunas acima + GRANTs (`authenticated` SELECT/INSERT via RPC only; `service_role` ALL) + RLS "user reads own" e "service_role manages".
- `CREATE FUNCTION public.pay_fiado_from_mp(...)` e `public.get_mp_fiado_status(...)`.
- Não altera nada do motor financeiro protegido — apenas envolve `pay_fiado` já auditado.

## Frontend (novos arquivos)

- `src/lib/mercadopago.ts`: adicionar `createMpFiadoPayment({ userId, amount })` e `fetchMpFiadoStatus(mpOrderId)`.
- `src/components/perfil/FiadoPixDialog.tsx`: novo dialog com campo de valor, geração do QR, polling (`setInterval` 3s), UI reaproveitando o padrão visual do `ComandaPixCharge`.
- `src/routes/_authenticated/perfil.tsx`: adicionar botão "Pagar com PIX" na seção Conta Corrente e montar o dialog.

## Validação
1. `bun run build`.
2. `security--run_security_scan` — garantir que a nova RPC e tabela estão travadas.
3. Teste manual: gerar PIX em ambiente sandbox, simular webhook, ver saldo devedor cair e extrato aparecer.

## Notas
- Não altera motor financeiro (apenas usa `pay_fiado` via wrapper).
- Multi-tenant preservado (empresa resolvida por host, credenciais MP por empresa).
- Sem alteração no card de cashback / abatimento.