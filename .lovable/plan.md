## Objetivo
Adicionar um **interruptor global de emissão fiscal** por empresa: quando ligado, todas as vendas geram NF automaticamente (comportamento correto/padrão); quando desligado, a empresa opera normalmente sem emitir nenhuma nota, por decisão do próprio admin.

Não é escolha por pedido. É uma chave única, no nível da empresa.

## Como vai funcionar

A tabela `config_fiscal` já tem a coluna `ativo` (boolean). Vamos usá-la exatamente como esse interruptor mestre:

- `ativo = true` → toda venda finalizada dispara emissão de NFC-e automaticamente (padrão correto).
- `ativo = false` → nenhuma nota é emitida, em lugar nenhum do sistema. O restante do fluxo (pagamento, estoque, comanda) segue normal.

Não precisa criar coluna nova — só passar a respeitar o `ativo` de verdade nos pontos de emissão.

## Onde aparece na tela

Na **aba Fiscal** (`/caixa?tab=fiscal`), no topo do card de configuração, um único switch bem visível:

**"Emitir Nota Fiscal automaticamente em todas as vendas"**  
Texto de apoio: *"Recomendado. Desative apenas se a sua empresa optou temporariamente por operar sem emissão fiscal."*

Quando desligado, aparece um aviso amarelo no topo da aba: *"Emissão fiscal desativada. Nenhuma nota está sendo gerada."* — para que fique óbvio ao operador e ao admin sempre que abrirem a tela.

Credenciais, certificado A1, séries e numeração continuam preservados — desligar não apaga nada, só suspende a emissão.

## Onde o motor respeita o switch

Adicionar um único guard `isEmissaoAtiva(empresa_id)` em `src/lib/fiscal/engine.ts` que lê `config_fiscal.ativo`. Antes de qualquer chamada real ao adapter, o engine consulta esse guard:

- Se `ativo = false` → retorna silenciosamente sem chamar o provedor (log local, sem toast de erro, sem gravar `notas_fiscais`).
- Se `ativo = true` → segue o fluxo atual.

Como o guard vive dentro do próprio `emitirNotaFiscalPorPedido`, os call sites atuais (`PaymentDialog`, `BalcaoView` e futuros pontos como `finalizeComandaSplit`) não precisam mudar — o comportamento correto é automático.

Manifestação de NF-e de entrada (consulta DFe) continua funcionando independentemente, pois é leitura, não emissão.

## O que NÃO muda

- Motor financeiro, RLS, triggers, `finalize_order_paid`: intocados.
- Estrutura de `notas_fiscais`, adapters, tipos fiscais: sem alteração.
- Nenhuma nova coluna, nenhuma migração de dados.

## Detalhes técnicos

- **Sem migração de schema.** A coluna `ativo` já existe e já é lida em `fetchFiscalConfig`.
- **`src/lib/fiscal/engine.ts`**: adicionar `isEmissaoAtiva(empresaId)` (SELECT `ativo` em `config_fiscal`) e chamar no início de `emitirNotaFiscalPorPedido`. Retorno padronizado `{ sucesso: true, status: "pendente", mensagem: "Emissão fiscal desativada pela empresa" }` para não quebrar tipagem dos call sites.
- **`src/components/caixa/FiscalConfigTab.tsx`**: substituir a ausência de UI para `ativo` por um `<Switch>` shadcn no topo do card, com label e helper text descritos acima, e o banner amarelo condicional.
- **Sem mudança em `PaymentDialog` / `BalcaoView`** — o guard fica no engine.
