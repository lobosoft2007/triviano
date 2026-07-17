## Objetivo
Adicionar seleção de **Orientação da página (Retrato / Paisagem)** ao framework de relatórios, disponível em todos os relatórios (começando pelo "Clientes cadastrados").

## Mudanças

1. **`src/lib/reports/types.ts`**
   - Estender `ReportPrefs` com `orientation: "portrait" | "landscape"` (default `"portrait"`, persistido em `localStorage` por relatório junto de fonte/colunas).
   - `printReport()` passa a receber `orientation` e injeta a regra dinamicamente:
     ```css
     @page { size: A4 <orientation>; margin: 14mm 12mm 20mm 12mm; }
     ```
     (substitui o `@page` fixo atual em portrait).

2. **`src/components/admin/reports/ReportShell.tsx`**
   - Novo controle na toolbar (ao lado do `FontPicker`): toggle/segmented "Retrato | Paisagem" com ícones (lucide `RectangleVertical` / `RectangleHorizontal`).
   - Estado controlado, salvo em prefs, passado para `printReport(orientation)`.
   - Aplicar também na pré-visualização em tela: quando `landscape`, o container `.report-a4` recebe largura equivalente a A4 paisagem (`max-width: 297mm`) em vez de 210mm, para o usuário ver o layout antes de imprimir.

3. **`src/styles.css`** (bloco `@media print` já existente)
   - Remover o `@page` fixo em portrait de dentro do bloco (agora vem do `<style>` injetado por `printReport`).
   - Manter as demais regras de header/footer fixos e `.printing-report`.

4. **`RelatorioClientes.tsx`**
   - Sem mudanças de lógica; apenas herda o novo controle do Shell. Sugestão de default `landscape` quando > 6 colunas visíveis fica **fora do escopo** desta etapa (o usuário escolhe manualmente).

## Fora de escopo
- Margens customizáveis, tamanhos diferentes de A4, marca d'água, cabeçalho/rodapé por página customizados.
