## Objetivo

Mover para o **/admin** dois módulos que hoje vivem no **/caixa**, por serem responsabilidade típica do administrador:

1. **Fiscal** (config NFC-e/NF-e, certificado A1, ativar/desativar emissão) — hoje em `Caixa`.
2. **Pagamento** (`PaymentConfigTab`: Mercado Pago, PIX estático, cashback, etc.) — hoje em `Caixa > Configurações`. Já existe uma aba "Pagamentos" em `/admin` renderizando o mesmo `PaymentConfigTab`, então na prática o Caixa mantinha uma cópia duplicada.

Nada de lógica de negócio muda — apenas onde as abas aparecem e quem consegue abri-las.

## Mudanças

### 1. `/admin` — passa a hospedar as abas

`src/routes/_authenticated/admin.tsx` e `src/components/admin/AdminSidebar.tsx`:

- Adicionar nova aba **`fiscal`** na tipagem `AdminTab`, no menu lateral (ícone `Receipt` ou `FileText`, grupo "Configurações") e no switch de conteúdo, renderizando `<FiscalConfigTab />` (importado de `@/components/caixa/FiscalConfigTab`, mesmo componente já existente — não vamos duplicar arquivo).
- A aba **`pagamentos`** já existe em `/admin`, não precisa mexer.
- Ambas continuam gated como `"master"` (só master admin / manager local), igual ao padrão atual do /admin.

### 2. `/caixa` — remove as abas

`src/routes/_authenticated/caixa.tsx`:

- Remover `fiscal` e `pagamento` de `CAIXA_TAB_TITLES` e dos `tab === ...` render blocks.
- Remover o import de `FiscalConfigTab`.
- Remover a exceção `tab !== "fiscal" && tab !== "pagamento"` na área de conteúdo (fica só o filtro para `config`).

`src/components/caixa/CaixaSidebar.tsx`:

- Remover o item "Fiscal" (bloco master direto) e o item "Pagamento" do grupo Configurações.

`src/lib/permissions.ts`:

- Remover `"pagamento"` e `"fiscal"` do tipo `CaixaTab`, do mapa `CAIXA_TAB_FLAG` e da lista `CAIXA_TAB_ORDER`. Isso garante typecheck para os call sites acima.

### 3. Nada mais muda

- `FiscalConfigTab`, `PaymentConfigTab`, engine fiscal, RLS, motor financeiro, Mercado Pago, cashback: **intocados**.
- Sem migração de banco.
- Sem alteração em `PaymentDialog`, `BalcaoView`, fluxo de pagamento no PDV.

## Observação

O nome do arquivo `src/components/caixa/FiscalConfigTab.tsx` fica onde está (movê-lo geraria diff maior sem valor). Se preferir mover para `src/components/admin/FiscalConfigTab.tsx` por organização, sinaliza que eu incluo o rename no mesmo passo.