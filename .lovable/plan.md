
## Objetivo

Você está certo: impressora térmica moderna já é gerenciada pela fila do SO (Windows/Linux). Basta o navegador mandar o cupom pra impressora correta — a fila entrega, empilha, avisa se acabou o papel, etc. Toda a camada de "impressão direta" (WebUSB / Web Serial / ESC-POS / pareamento Zadig / Elgin Virtual COM) é complexidade desnecessária e é a origem dos "acesso negado" que você viu.

Este plano remove essa camada e deixa o fluxo com uma única forma de impressão: **`window.print()` roteado por setor**, exatamente como já funciona para os cupons de preparo (cozinha/bar/pizzaria).

## O que muda para o operador

- **Cozinha / Bar / Pizzaria:** continua igual — 1 cupom por setor, cada um sai na impressora certa (a "impressora padrão" configurada na fila do SO daquele setor).
- **Conta da mesa / conferência:** passa a usar o mesmo mecanismo dos setores (diálogo do navegador → fila do SO). No Chrome/Edge dá pra marcar "sempre imprimir sem perguntar" e a experiência fica silenciosa, sem WebUSB.
- **Cadastro de impressoras (Admin):** mantém nome, cor e vínculo com categoria (para roteamento visual e agrupamento de itens). Deixa de exibir campos irrelevantes para a fila do SO.

## O que remover

1. `src/lib/thermal-printer.ts` — WebUSB / Web Serial / ESC-POS / preferência local (`getThermalPref` / `setThermalPref` / `clearThermalPref` / `isThermalSupported` / `printThermalBytes` / `requestThermalUsb` / `requestThermalSerial` / `buildTestCoupon`).
2. `src/lib/thermal-receipts.ts` — `buildMesaBillEscPos` (bytes ESC/POS da conta).
3. `src/routes/_authenticated/caixa.tsx`:
   - imports de `thermal-printer` e `thermal-receipts`;
   - passos **3) Impressão direta na térmica** dentro de `printBill` (linhas ~723–759) — deixa só o passo 4 (diálogo do navegador → fila do SO);
   - componente `ThermalDirectPrintCard` inteiro (linhas ~2176–2423) e sua renderização na aba Config;
   - toasts / imports órfãos (`Usb`, `Network`, `Check`, `X`, `Printer` — só os que sobrarem sem uso).

## O que mantém intacto

- `dispatchPreparation` e `SectorReceipt` (roteamento por setor, 1 cupom por impressora) — é exatamente o modelo "manda pra fila certa" que você quer.
- `BillReceipt` + `printAndRun` (`window.print`) para a conta da mesa, com QR do MP ou PIX estático embutido — só passa a ser o único caminho.
- `printers.ts`, `config_impressoras`, `makeSectorResolver`, tags coloridas no /caixa, vínculo categoria→impressora no Admin.
- `MesasQrTab.tsx` e `BalcaoView.tsx` (já usam `window.print`).

## Ajustes menores no cadastro de impressoras (Admin)

O cadastro atual tem campos que só faziam sentido para impressão direta. Manter só o que a fila do SO precisa:

- **Manter:** `nome`, `cor`, `is_default`, `ativo`, vínculo com categorias.
- **Ocultar da UI (sem migração):** `tipo_conexao`, `endereco_ip`, `porta`, `caminho_usb`. As colunas continuam no banco (para não quebrar tipos), só somem do formulário (`PrinterCard`). O motor de roteamento não usa esses campos.

Nenhuma migração SQL é necessária.

## Documentação curta na UI

Nota discreta no card "Impressoras" do Admin:

> A impressão usa a fila do sistema operacional. Configure cada impressora como padrão na estação correspondente (cozinha, bar, caixa) — o Triviano envia o cupom certo para cada setor automaticamente.

## Arquivos afetados

- **Excluir:** `src/lib/thermal-printer.ts`, `src/lib/thermal-receipts.ts`.
- **Editar:** `src/routes/_authenticated/caixa.tsx` (remover imports, passo 3 do `printBill`, componente `ThermalDirectPrintCard`, campos ocultos no `PrinterCard`).
- **Sem alterações:** banco de dados, RLS, motor financeiro, `printers.ts`, `MesasQrTab.tsx`, `BalcaoView.tsx`, `ContaCorrenteTab.tsx`.

## Fora de escopo

- Servidor de impressão local (CUPS/IPP), agentes desktop, drivers customizados, integração com PrintNode/Google Cloud Print. Se um dia precisar de impressão 100% silenciosa multi-estação, isso vira um projeto próprio.
- Motor financeiro / webhook MP / PIX (protegidos por `mem://constraints/motor-financeiro-protegido`) — não são tocados.
