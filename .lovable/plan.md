
# Recebimento de Ordens de Compra

Hoje temos dois fluxos desconectados:
- **Ordens de Compra** (planejamento/pedido ao fornecedor) — Admin → Compras
- **Entrada Avulsa** (recebimento sem vínculo à ordem) — atualiza saldo/custo e financeiro

Falta o ciclo do meio: **abrir a ordem, conferir cada item (quantidade real e preço pago), marcar se veio com ou sem NF e dar entrada de fato no estoque**. Este plano fecha esse ciclo reutilizando o motor que já existe para entrada avulsa (que já faz baixa de saldo, recálculo de custo médio ponderado e lançamento financeiro).

## Escopo

1. Novo botão **"Receber Mercadoria"** em cada Ordem de Compra com status `Aberta` (na lista de Ordens e no detalhe).
2. Novo diálogo **`RecebimentoOrdemDialog`** que carrega os itens da ordem e permite:
   - Editar **quantidade recebida** por item (default = quantidade da ordem).
   - Editar **custo unitário real** por item (default = custo da ordem).
   - Marcar item como "não recebido" (quantidade = 0).
   - Ver, ao lado de cada linha, saldo atual e custo atual do insumo/produto para conferência.
3. Cabeçalho do recebimento:
   - Toggle **Com NF / Sem NF**.
   - Se **Com NF**: campos `numero_nf`, `serie_nf` (opcional), `chave_acesso` (opcional, 44 dígitos), `data_emissao`, `data_entrada` (default hoje).
   - Se **Sem NF**: campo `observacao` obrigatório (ex.: "compra em atacado").
   - Fornecedor (herdado da ordem, editável).
   - **Pagar com a conta** (mesma seleção da Entrada Avulsa, opcional → não lança financeiro).
4. Ao confirmar:
   - Persistir o recebimento vinculado à ordem.
   - Baixar estoque + recalcular custo médio por item (mesma RPC que a Entrada Avulsa já usa).
   - Se **Com NF**, gravar dados fiscais junto ao recebimento (número/chave/data) para futura conciliação com o módulo Fiscal / Manifestação.
   - Se conta financeira selecionada, lançar despesa (a pagar hoje).
   - Fechar a ordem: status `Recebida` (ou `Parcial` se algum item ficou com quantidade menor que a pedida — ver seção "Recebimento parcial").
5. **Impressão / histórico**: reaproveitar `ReportShell` para gerar um comprovante A4 do recebimento (mesmo padrão do relatório de Ordem de Compra recém-corrigido).

## Recebimento parcial

- Se qualquer item foi recebido com quantidade menor que a pedida, a ordem fica `Parcial` e continua permitindo novos recebimentos até completar (ou ser encerrada manualmente).
- Cada recebimento é um registro próprio, com seu próprio nº, NF e lançamento financeiro — nunca sobrescreve os anteriores.
- Botão "Encerrar ordem" no detalhe (força status `Recebida` mesmo com saldo pendente, para casos de cancelamento parcial pelo fornecedor).

## Backend (migração)

Novas tabelas (com GRANT + RLS por `empresa_id` já no mesmo migration):

- **`recebimentos_ordem`** — cabeçalho
  - `id_ordem_compra`, `numero` (SEQUENCE por empresa), `com_nf` bool, `numero_nf`, `serie_nf`, `chave_acesso`, `data_emissao`, `data_entrada`, `id_fornecedor`, `id_conta_financeira` (nullable), `observacao`, `valor_total`.
- **`itens_recebimento_ordem`** — linhas
  - `id_recebimento`, `id_item_ordem` (nullable, para item livre), `tipo` (`insumo` | `produto`), `ref_id`, `quantidade_recebida`, `custo_unitario_pago`, `subtotal`.

Nova RPC **`receber_ordem_compra(p_ordem_id, p_cabecalho jsonb, p_itens jsonb)`** (SECURITY DEFINER, em transação):
1. Valida que a ordem pertence à empresa e está `Aberta` ou `Parcial`.
2. Insere `recebimentos_ordem` + `itens_recebimento_ordem`.
3. Para cada item, delega ao mesmo motor da Entrada Avulsa (`registrar_entrada_avulsa` / `registrar_entrada_produtos`) — isso já faz **baixa de saldo** e **recálculo de custo médio ponderado**.
4. Se `id_conta_financeira` presente, cria lançamento em `fluxo_caixa` (débito) como despesa a pagar/paga (mesmo padrão da Entrada Avulsa).
5. Recalcula status da ordem (`Recebida` / `Parcial`) comparando quantidades recebidas acumuladas vs. pedidas.

RPC de leitura **`get_recebimentos_ordem(p_ordem_id)`** para listar histórico de recebimentos da ordem no diálogo de detalhe.

## Frontend

Arquivos novos:
- `src/components/admin/RecebimentoOrdemDialog.tsx` — diálogo principal (baseado em `OrdemCompraManualDialog` para consistência visual + `EntradaEstoqueView` para lógica de linhas).
- `src/components/admin/reports/RelatorioRecebimento.tsx` — comprovante A4 (padrão `ReportShell`).
- `src/lib/recebimentos.ts` — funções `receberOrdemCompra`, `listRecebimentosOrdem`.

Arquivos alterados:
- `src/components/admin/OrdemCompraDetailDialog.tsx` — adicionar aba/seção "Recebimentos" e botão **"Receber Mercadoria"** (habilitado se status ≠ `Recebida`).
- Lista de Ordens (`SugestaoComprasView.tsx` / view de Ordens): coluna de status ganha badge `Aberta / Parcial / Recebida`; ação "Receber" no menu de cada linha.
- `src/lib/estoque.ts` — tipar `status` da ordem incluindo `Parcial` e `Recebida`.

## Detalhes técnicos

- Custo médio ponderado é calculado hoje pelo mesmo trigger/RPC que a Entrada Avulsa usa; não vamos duplicá-lo, só chamamos.
- Para produtos de revenda (`manipulado = false`), a atualização de `custo_compra` reflete diretamente no `custo_total` (já coberto por `computeCustoTotal` em `src/lib/cost.ts`). Para insumos, o novo `custo_unitario` propaga automaticamente para todos os produtos manipulados via `fetchProductCustoTotal`.
- Dados de NF ficam apenas no cabeçalho do recebimento nesta fase. **Integração com download de NF-e da SEFAZ e conciliação automática com o módulo Fiscal (`notas_fiscais` / `manifestacoes_destinatario`) fica para uma fase 2**, quando o motor de manifestação estiver validado em produção — só precisamos garantir que `chave_acesso` gravada aqui possa ser cruzada depois.
- RLS: todas as novas tabelas usam `empresa_id` + `has_role`/`current_empresa_id()` no mesmo padrão de `ordens_compra` / `entradas_avulsas_estoque`.

## Fora do escopo (fases futuras)

- Download automático da NF-e via SEFAZ e conciliação com a manifestação.
- Divergências entre NF e pedido gerando alerta/relatório de auditoria.
- Rateio de frete/impostos no custo unitário (será um campo `custo_extra` distribuído proporcionalmente).
- Devolução parcial ao fornecedor.

## Entregáveis

1. Migração com tabelas, GRANT, RLS, RPC `receber_ordem_compra` e `get_recebimentos_ordem`.
2. `src/lib/recebimentos.ts`, `RecebimentoOrdemDialog.tsx`, `RelatorioRecebimento.tsx`.
3. Ajustes em `OrdemCompraDetailDialog.tsx` e na lista de ordens.
4. Teste manual: criar ordem → receber com NF (parcial) → completar segundo recebimento sem NF → validar saldo, custo médio e lançamento financeiro.
