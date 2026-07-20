## Onde a Ordem de Compra fica hoje

Toda ordem criada (pelo botão "Manual/Avulsa" ou pelo "Gerar ordem" da sugestão) é gravada em `ordens_compra` + `itens_ordem_compra` e aparece na seção **"Ordens de compra recentes"** no final da mesma tela **Admin → Compras → Sugestão de Compras**. Hoje essa lista é só leitura — não dá para abrir, editar, reimprimir, reenviar por WhatsApp, baixar em PDF ou excluir. É isso que vamos resolver.

## O que vou construir

### 1. Backend (uma migration)
- **RPCs novas** (SECURITY DEFINER, isoladas por `empresa_id` do usuário):
  - `get_ordem_compra(p_id uuid)` → devolve cabeçalho + itens + fornecedor (nome/CNPJ/telefone).
  - `atualizar_ordem_compra(p_id, p_observacao, p_id_fornecedor, p_itens jsonb)` → substitui os itens, recalcula `valor_total`, bloqueia se `status <> 'Aberta'`.
  - `excluir_ordem_compra(p_id)` → só permite quando `status = 'Aberta'` (ordens já recebidas/lançadas ficam protegidas).
- Grants para `authenticated`, checagem de permissão via `can_manage_empresa`.

### 2. Camada de dados (`src/lib/estoque.ts`)
- Adicionar `getOrdemCompra`, `atualizarOrdemCompra`, `excluirOrdemCompra` chamando as RPCs acima.
- Estender `listOrdensCompra` para trazer também `status` e telefone do fornecedor (para o WhatsApp).

### 3. UI — `SugestaoComprasView.tsx`
Transformar a lista "Ordens de compra recentes" em tabela acionável, com cada linha oferecendo:
- **Abrir** (ícone olho) → abre novo `OrdemCompraDetailDialog`.
- **Imprimir** (ícone impressora) → reaproveita `OrdemCompraReport` + `window.print()`.
- **PDF/WhatsApp** (ícone Send) → reaproveita `shareNodeAsPdfWhatsapp` com o telefone do fornecedor pré-preenchido no `wa.me/<telefone>`.
- **Baixar PDF** (ícone download) → `downloadNodeAsPdf`.
- **Excluir** (ícone lixeira) → confirmação; só habilitado quando `status = 'Aberta'`.
- Badge de status ao lado do número (Aberta/Recebida) e busca por nº/fornecedor.

### 4. Novo componente `OrdemCompraDetailDialog.tsx`
Baseado no `OrdemCompraManualDialog` já existente (mesma grade buscável, mesmas colunas Item / Setor / Fornecedor / Estoque (mín/máx) / Custo / Qtd / Subtotal), mas em modo edição de uma ordem existente:
- Carrega itens via `getOrdemCompra`.
- Permite alterar quantidade, custo unitário, fornecedor da ordem, observação.
- Botões: **Salvar alterações**, **Imprimir**, **Enviar PDF por WhatsApp**, **Baixar PDF**, **Excluir**.
- Edição/exclusão bloqueadas visualmente quando a ordem já saiu de "Aberta".

### 5. Ajuste no `OrdemCompraManualDialog` (após criar)
Depois que a ordem é criada com sucesso, em vez de só fechar o diálogo, mostrar toast com atalho "Ver / Imprimir" que abre direto o `OrdemCompraDetailDialog` daquela ordem — assim o usuário nunca fica "perdido" após clicar Gerar.

## Fora do escopo (mantém como está)
- Recebimento de mercadoria / conciliação de NF (já é outro fluxo).
- Alterar o status manualmente — muda automaticamente conforme o recebimento.
- Motor financeiro, RLS, GRANTs existentes (protegidos por `mem://constraints/motor-financeiro-protegido`).