## Diagnóstico

O erro `Failed to execute 'open' on 'USBDevice': Access denied.` é **exclusivo do Windows** quando outra coisa já tem posse do dispositivo. No caso da Elgin i7 Plus, o **driver oficial da Elgin** (spooler de impressão do Windows) mantém a impressora "claimed" — o Chrome consegue **enumerar** (por isso o pareamento funciona), mas não consegue **abrir** o canal bulk-out.

Você não vê porta COM porque a i7 Plus, com o driver padrão da Elgin, expõe **só** a interface USB Printer Class — não a porta serial virtual. (Modelos com firmware/driver "USB-COM" opcional expõem; o seu não está assim configurado.)

Existem só três caminhos reais para resolver isso, e nenhum deles é código nosso — é configuração do Windows:

### Caminho A — Substituir o driver por WinUSB (Zadig) → USB direto funciona
Procedimento externo, ~2 minutos. Depois disso o WebUSB abre o dispositivo silenciosamente e a impressão direta funciona. **Perde a impressora do Windows** (deixa de aparecer em "Impressoras e scanners" — some para o Word, Excel etc.). Só faz sentido se a máquina do caixa **só** imprime cupom.

### Caminho B — Ativar modo "USB Virtual COM" no utilitário da Elgin → Web Serial funciona
A Elgin distribui um utilitário (`Elgin Printer Utility` / `i7 Config`) que permite trocar a interface USB de "Printer" para "Virtual COM". Feito isso, aparece uma COM no Gerenciador de Dispositivos e o botão **Conectar via porta COM (Serial)** passa a listá-la. Mantém a impressora funcional pro sistema? **Não** — no modo COM ela sai da lista de impressoras do Windows.

### Caminho C — Fallback automático para o diálogo do navegador (Ctrl+P) → funciona com o driver Elgin instalado, sem mexer em nada
É o **caminho de menor atrito** e é o que vou implementar agora no código. Já existe a superfície de impressão HTML (`<div className="thermal-receipt">`) usada como fallback. Vou automatizar o fallback e comunicar melhor.

## Plano (só Caminho C no código; A e B ficam como instrução na UI)

### Passo 1 — Detectar "Access denied" e cair automaticamente para `window.print()`
Em `src/routes/_authenticated/caixa.tsx`, no fluxo de impressão da conta da mesa (por volta da linha 724, `printThermalBytes(...)`), envolver a chamada em try/catch. Se `err.message` bater em `access denied|failed to (open|claim)|the device was disconnected`, chamar imediatamente o fluxo `window.print()` que já existe, sem toast de erro (apenas um `toast.info` discreto: "Impressora ocupada pelo driver do Windows — usando diálogo do navegador."). Isso garante que **a conta sempre sai**, mesmo que o USB direto esteja bloqueado.

### Passo 2 — Mesmo tratamento no teste do pareamento
No `handleConnect` do `ThermalDirectPrintCard`, quando o teste falhar com "Access denied", trocar o `toast.warning` genérico por um toast explicativo mais longo (duração 10s) apontando os dois caminhos externos:

> "Pareada, mas o Windows não libera o acesso direto (driver da Elgin está usando). A impressão da conta vai continuar funcionando pelo diálogo do navegador. Para impressão silenciosa: (1) ative 'USB Virtual COM' no utilitário da Elgin e use o botão Serial, **ou** (2) troque o driver da impressora por WinUSB via Zadig."

### Passo 3 — Card de ajuda "Windows bloqueou o USB?" abaixo dos botões
Quando `pref?.transport === "webusb"` **e** o último teste retornou "Access denied" (guardar num `useState` local `lastError`), renderizar um accordion pequeno com o passo-a-passo dos Caminhos A e B, para o operador consultar sem sair da tela.

### Passo 4 — Ajuste no botão Serial quando nenhuma porta aparece
Hoje, se você clica em **Conectar via porta COM** e o diálogo vem vazio, o erro é o mesmo `No device selected` do USB. Adicionar um toast dedicado quando `kind === "serial"` retornar vazio:

> "Nenhuma porta COM disponível. A Elgin i7 Plus só expõe COM se você ativar 'USB Virtual COM' no utilitário oficial da Elgin."

## Fora de escopo
- Não vamos automatizar Zadig nem alterar o driver do Windows (impossível pelo navegador).
- Nenhuma mudança de banco, RLS, motor financeiro, ou do formato do cupom.
- Nada de instalar QZ Tray / helpers nativos — mantém o app 100% web.

## Resultado esperado
Depois do Passo 1, **você imprime a conta hoje mesmo**, com o driver da Elgin como está: a primeira tentativa direta falha silenciosamente, o navegador abre o Ctrl+P automaticamente com o cupom pronto, você confirma e sai. Se depois quiser impressão 100% silenciosa, o card do Passo 3 te guia por Zadig ou pelo modo COM.