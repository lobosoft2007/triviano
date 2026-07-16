## Diagnóstico do "Conectar USB" vazio (Elgin i7 Plus)

Quando você clica em **Conectar USB** e a lista do Chrome aparece vazia, quase sempre é um destes três motivos — nenhum é bug do nosso código, é como o WebUSB funciona no Windows:

1. **A Elgin i7 Plus está instalada como impressora do Windows.** O driver oficial da Elgin "sequestra" o dispositivo (claim exclusivo). Enquanto o driver do Windows estiver ativo, o Chrome **não enxerga** a impressora via WebUSB — ela nem aparece na lista.
2. **Nosso `requestDevice` está com `filters: []`.** Alguns builds do Chrome escondem dispositivos genéricos quando não há filtro por Vendor ID. Adicionar o VID da Elgin (`0x0416`) e a classe "Printer" (USB class 7) melhora bastante a lista.
3. **Web Serial não foi tentado como alternativa.** A i7 Plus expõe também porta serial virtual (COM) via USB — o Web Serial vê essa porta mesmo com o driver de impressora instalado, e imprime ESC/POS igualzinho.

## Plano

### Passo 1 — Melhorar o seletor USB (`src/lib/thermal-printer.ts`)
Trocar `requestDevice({ filters: [] })` por uma lista de filtros que abre a porta para a Elgin (e outras marcas comuns) sem excluir nada:

```ts
filters: [
  { classCode: 7 },              // USB Printer class
  { vendorId: 0x0416 },          // Elgin / Winbond
  { vendorId: 0x04b8 },          // Epson
  { vendorId: 0x0483 },          // Bematech / STM
  { vendorId: 0x1fc9 },          // NXP (Daruma etc.)
]
```
Sem `filters: []`. Isso força o Chrome a listar qualquer impressora ESC/POS mesmo que o Windows já tenha driver instalado — o item aparece cinza/"em uso" mas pelo menos aparece.

### Passo 2 — Botão "Conectar via Serial (COM)" no Caixa → Configurações → Impressoras
Já existe `requestSerialPort()` na lib, mas a UI só expõe o botão USB. Adicionar um segundo botão **Conectar via porta serial (COM)** que chama `requestSerialPort()` e salva a preferência com `transport: "webserial"`. Este é o **caminho recomendado** quando o driver da Elgin já está instalado — funciona sem desinstalar nada.

### Passo 3 — Mensagem de ajuda no diálogo vazio
Se o `requestDevice` retornar erro "No device selected" (usuário fechou a janela vazia), mostrar um toast com o passo-a-passo:
- "Nenhuma impressora apareceu? Tente **Conectar via porta serial (COM)** — funciona com o driver Elgin já instalado."
- "Ou, para usar por USB, será necessário substituir o driver da Elgin pelo WinUSB via Zadig (procedimento avançado)."

### Passo 4 — Teste
Você clica em **Conectar via porta serial (COM)**, escolhe a COM da Elgin (geralmente COM3/COM4), roda **Imprimir teste**. Se sair o cupom "*** TESTE OK ***", está pareado — a partir daí toda conta de mesa imprime direto.

## Fora de escopo
- Nenhuma mudança de banco, RLS, motor financeiro ou de UI além do botão extra e do toast.
- Não vamos mexer no driver do Windows nem instalar Zadig — isso é procedimento externo, apenas documentado se o USB direto for necessário.

## Por que não é bug nosso
O comportamento "lista vazia" é padrão do Chrome + Windows quando a impressora tem driver nativo. O caminho **Web Serial** contorna isso sem exigir alteração no sistema, e é o que praticamente todos os PDVs web usam com Elgin/Bematech/Epson.