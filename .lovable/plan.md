## 1) Impressão direta da conta via WebUSB / Web Serial

Objetivo: ao clicar "Imprimir conta / conferência" na mesa, o cupom sai instantaneamente na impressora térmica configurada, sem diálogo do navegador, sem instalação de nada, sem afetar outros programas do PC.

### Escopo técnico

**a) Nova lib `src/lib/thermal-printer.ts`**
- `requestUsbDevice()` → `navigator.usb.requestDevice({ filters: [{ classCode: 7 }] })` (classe "Printer") + `open()`, `selectConfiguration(1)`, `claimInterface(0)`, descobre `endpointOut`.
- `requestSerialPort()` → `navigator.serial.requestPort()` + `open({ baudRate: 9600 })`.
- `encodeReceipt(lines)` → monta bytes ESC/POS: init (`0x1B 0x40`), CP850, alinhamentos, negrito, largura dupla no cabeçalho, feed final, corte parcial (`0x1D 0x56 0x42 0x00`).
- `printBytes(bytes)` → escreve no endpoint/porta previamente aberto; reabre com a permissão salva (via `navigator.usb.getDevices()` / `navigator.serial.getPorts()`) sem reprompt.
- `isSupported()` → detecta a API disponível no navegador atual.

**b) Persistência da preferência**
- `localStorage` por empresa: `thermal-printer:<empresaId>` = `{ transport: 'webusb'|'webserial', vendorId, productId, serialNumber }`.
- Reaproveita a permissão que o navegador já guarda no perfil — não precisa reprompt em cada uso.
- Sem migração de schema. Se quisermos guardar por-usuário mais tarde, viramos coluna em `config_impressoras`; por ora, é preferência local do PC.

**c) UI de conexão (dentro de `src/routes/_authenticated/caixa.tsx`, no bloco de impressoras)**
- Novo botão "Conectar impressora térmica" ao lado de cada impressora com `tipo_conexao='USB'`.
- Botão abre o seletor nativo → salva a preferência → dispara um cupom de teste ("*** TESTE OK ***" + corte).
- Indicador visual: "Conectada · Bematech MP-4200 TH" (verde) ou "Não configurada · usa diálogo do navegador" (âmbar).

**d) Integração no fluxo de impressão**
- Refatorar `printAndRun` em `caixa.tsx` para tentar, nesta ordem:
  1. Se há preferência salva e `isSupported()`: renderiza o cupom em texto (mesmo conteúdo do `BillReceipt` atual, só que em `string` monoespaçada), passa por `encodeReceipt` + `printBytes`.
  2. Se falhar (impressora offline, permissão revogada): fallback para `window.print()` atual + toast "Impressão direta indisponível — imprimindo pelo navegador".
- Novo helper `renderBillAsText(mesa, orders, empresa)` que produz as linhas do cupom (cabeçalho da empresa, mesa, itens, subtotal/gorjeta/total, rodapé). Mantém o `BillReceipt` React só para o fallback e para impressão em outros contextos que ainda usam `window.print`.

**e) Escopo restrito**
- Só a "Imprimir conta / conferência" da mesa usa o caminho novo nesta fase. Cupons de cozinha (`dispatchPreparation`), balcão, extrato de fiado continuam como estão. Se aprovado, migramos os demais em uma fase 2.

### Limitações honestas
- Funciona em Chrome/Edge desktop e Android. Safari/iOS não suportam WebUSB nem Web Serial — nesses navegadores o fallback `window.print()` continua ativo.
- Depende de impressora ESC/POS (padrão em térmicas 80mm de PDV). Impressoras "GDI-only" ficam no fallback.
- A permissão é por perfil de navegador — se o operador trocar de PC/perfil, precisa reconectar uma vez.

---

## 2) Troco em dinheiro no "Finalizar e Receber" (aprovado)

Apenas front-end, em `src/components/caixa/ComandaPaymentDialog.tsx`:

- Detectar drafts de dinheiro reaproveitando `NON_CASH_MEIOS` (o que não está no set é dinheiro).
- Calcular `excedente = max(0, totalPago − totalConta)` e `cashPago = soma dos drafts em dinheiro`.
- `troco = min(excedente, cashPago)`. Excedente em cartão/PIX continua bloqueando (não faz sentido dar troco em cartão).
- Habilitar "Finalizar e Receber" quando `restante ≤ 0 && excedente === troco`.
- Resumo ganha linha "Troco" em verde/negrito quando `troco > 0`; linha "Excedente" em vermelho quando `excedente > troco`.
- Antes de chamar `finalizeComandaSplit`, cortar o excesso dos drafts de dinheiro (reduzindo o último) para que a soma enviada bata exatamente com `totalConta`. Troco é físico, não entra em `pagamentos_pedido`.
- Toast final: `Mesa X liquidada! Troco: R$ Y,YY`.

**Não altera**: `finalize_comanda_split`, `_finalize_order_financials`, RPCs, triggers, motor financeiro, `PaymentDialog` do delivery, PIX online.

---

## Validação

- Chrome desktop, primeira vez: clicar "Conectar impressora térmica" → escolher a térmica no seletor → cupom de teste sai. Fechar e reabrir o navegador → segue conectada sem reprompt.
- Clicar "Imprimir conta" numa mesa aberta → cupom sai direto, sem diálogo.
- Desconectar o cabo USB e imprimir → toast informa que caiu no fallback e o diálogo do navegador aparece.
- Safari → botão "Conectar" fica desabilitado com tooltip "Não suportado neste navegador"; impressão usa diálogo normal.
- Mesa R$ 87,00, lançar Dinheiro R$ 100,00 → botão habilita, resumo mostra "Troco R$ 13,00", banco grava R$ 87,00.
- Mesa R$ 87,00, lançar Cartão R$ 100,00 → botão continua bloqueado (excedente em cartão).
- Mesa R$ 87,00, Cartão R$ 50 + Dinheiro R$ 50 → troco R$ 13, envia Cartão 50 + Dinheiro 37.
