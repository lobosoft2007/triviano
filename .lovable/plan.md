# Triviano Tap — Provedores configuráveis pelo Admin

Sim, é totalmente viável e é o desenho certo para SaaS multi-tenant: cada dono de restaurante escolhe no `/admin` qual provedor Tap on Phone / PIX quer usar e coloca as próprias credenciais. O app garçom lê essa configuração do backend a cada login — nada fica hardcoded no APK. Primeiros provedores homologados: **Mercado Pago Point Tap** e **PagBank Tap to Pay**.

## Como fica no Admin

Nova aba **"Tap on Phone"** dentro de **Admin → Empresa → Pagamentos** (ao lado do PIX estático e do Mercado Pago Checkout que já existem):

- Dropdown "Provedor ativo": `Mercado Pago` | `PagBank` | `Desativado`.
- Campos dinâmicos por provedor (o form troca conforme a escolha):
  - **Mercado Pago**: `access_token`, `user_id`, `store_id`, `pos_id`, `application_id`, ambiente (produção/homologação).
  - **PagBank / PagSeguro**: `client_id`, `client_secret`, `token_aplicacao`, `codigo_ativacao_maquininha`, ambiente.
- Botão "Testar credenciais" → chama o provedor e devolve OK/erro.
- Lista de dispositivos pareados (reaproveita `pos_devices`, filtrando `tipo='tap_phone'`) com status online/offline.

Tudo isolado por `empresa_id` via RLS — Empresa A jamais lê credenciais da Empresa B.

## Modelo de dados (mínimo, tudo em uma migração)

Uma tabela nova `tap_provider_config` (não misturamos com `config_pagamentos` para manter o motor financeiro protegido intacto):

- `id`, `empresa_id` (default `current_empresa_id()`), `provider` (`mercadopago` | `pagbank`), `ativo` (bool), `ambiente` (`prod`|`sandbox`), `credentials` (JSONB **criptografado** via `pgsodium`/`vault`, mesmo padrão do `ai_report_api_key`), `created_at`, `updated_at`.
- Índice único parcial: uma linha ATIVA por empresa.
- Grants: `authenticated` só via RPC (nunca lê a coluna crua); `service_role` full.
- RLS: `SELECT/INSERT/UPDATE` restrito a `can_manage_empresa(empresa_id)`.
- RPCs:
  - `get_tap_config_public()` → devolve para o app garçom só o mínimo necessário para o SDK (provider, ambiente, tokens públicos), **nunca** o secret bruto — quando o SDK precisa de secret, a cobrança é intermediada por uma server function.
  - `save_tap_config(provider, ambiente, credentials jsonb)` → grava criptografado.
  - `tap_charge(pedido_id, valor, tipo)` (server function) → assina a chamada ao provedor server-side quando ele exigir secret; devolve NSU/autorização; grava em `pagamentos_pedido` e chama `finalize_comanda_split`, exatamente como o fluxo já existente.

Nada muda em `meios_pagamento`, `pos_devices` (só usamos `tipo='tap_phone'`), triggers financeiros, ou RLS de `orders/comanda_ativa`.

## Como o app garçom consome

No login, o app chama `get_tap_config_public()` → sabe qual SDK carregar. Os SDKs de Mercado Pago Point Tap e PagBank Tap são incluídos no **mesmo APK** (não precisamos de flavor por provedor — os dois SDKs coexistem; só um é inicializado em runtime conforme a config da empresa). Isso simplifica publicação: **um único APK** por versão, sem `productFlavors`.

Vantagem prática: se o dono do restaurante trocar de Mercado Pago para PagBank, ele muda no Admin e o app garçom carrega o outro provedor no próximo login — sem reinstalar APK.

## Fases (revisadas com sua decisão)

- **T0 — Migração + Admin (backend)**: tabela `tap_provider_config`, RLS, RPCs, aba "Tap on Phone" no Admin com Mercado Pago e PagBank. **Testável imediatamente** com "Testar credenciais".
- **T1 — App base Tap** (RN, sem SDK): telas Login/Mesas/Cardápio/Comanda/Cobrar (simulador).
- **T2 — PIX dinâmico** (funciona nos dois provedores via Mercado Pago Checkout já plugado + endpoint PIX do PagBank): entrega valor antes da homologação Tap.
- **T3 — SDK Mercado Pago Point Tap**: bridge Android + tela Diagnóstico.
- **T4 — SDK PagBank Tap to Pay**: bridge Android + Diagnóstico.
- **T5 — Homologação nos dois** e publicação.

## Perguntas antes de abrir a T0

1. Confirma **um único APK com os dois SDKs**, escolhendo em runtime pela config da empresa? (Recomendo sim — menos atrito para o cliente.)
2. Já tem contas developer no **Mercado Pago Point** e no **PagBank Tap** (precisamos do access token para testar), ou começo pela T0 usando apenas ambiente sandbox de ambos?