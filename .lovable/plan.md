
# Sandbox Tecnospeed / PlugNotas — o que falta

Hoje o adapter `TecnospeedAdapter` é um esqueleto: ele chama endpoints inventados (`POST /nfce`, `POST /nfe`, `GET /dfe`, `POST /manifestacao`) com um payload genérico. O PlugNotas usa endpoints e um schema JSON completamente diferentes, e exige que o certificado A1 esteja **cadastrado na conta deles**, não só no nosso bucket. Enviar como está hoje = 100% de erro de sandbox.

O plano abaixo deixa o sandbox operacional sem tocar em nada de venda/caixa.

## Escopo

1. **Reescrever o adapter para o PlugNotas real**
   - `base_url` sandbox: `https://api.sandbox.plugnotas.com.br`; produção: `https://api.plugnotas.com.br`. A UI já tem esse campo; só vou colocar defaults corretos por ambiente.
   - Autenticação por header `x-api-key` (PlugNotas não usa Bearer). Manter `bearer_token` no schema por retrocompatibilidade, mas priorizar `api_key`.
   - Endpoints reais:
     - NFC-e: `POST /nfce`, consulta `GET /nfce/consultar/{id}`, PDF `GET /nfce/pdf/{chave}`, XML `GET /nfce/xml/{chave}`, cancelamento `POST /nfce/cancelamento`.
     - NF-e: `POST /nfe`, mesmos padrões de consulta/PDF/XML/cancelamento.
     - MDe (documentos destinados): `GET /nfe/mde` com `cnpj` + `nsu`.
     - Manifestação: `POST /nfe/manifestacao`.
     - Certificado: `POST /certificado` (multipart, `.pfx` + senha + CNPJ) e `GET /certificado/{cnpj}`.
     - Empresa/emitente: `POST /empresa` no primeiro save (o PlugNotas guarda os dados do emitente pelo CNPJ; requisições de emissão passam a referenciar só o CNPJ).
   - Payload de emissão no schema real do PlugNotas (`idIntegracao`, `natureza`, `serie`, `numero`, `presenca`, `pagamento[]`, `produto[]` com `item.codigo/descricao/ncm/cest/cfop/unidade/quantidade/valorUnitario/valorTotal`, `imposto.icms{origem,csosn|cst}`, etc.). Mapear a partir do que o `engine.ts` já monta.

2. **Upload automático do certificado para o PlugNotas**
   - Novo server fn `uploadCertificadoFiscal({ empresa_id })`: baixa o `.pfx` do bucket `certificados-fiscais` (via `supabaseAdmin`), lê a senha de `config_fiscal.certificado_a1_senha_criptografada`, envia multipart para `POST /certificado` do PlugNotas com o CNPJ da empresa, e grava `config_fiscal.certificado_provider_id` + `certificado_sincronizado_em`.
   - Migration: adicionar essas duas colunas em `config_fiscal` (sem mexer em nada existente).
   - Botão “Sincronizar certificado com o provedor” na aba Fiscal do Admin. Salvamento do certificado passa a **sugerir** sincronizar. Só admin da empresa executa.
   - Igual sincroniza `POST /empresa` com dados do emitente (CNPJ, IE, endereço, regime) para não precisar mandar tudo em cada NFC-e.

3. **Painel de sandbox / diagnóstico**
   - Novo card “Testes de Sandbox” em Admin → Fiscal, só visível quando `ambiente = homologacao`:
     - Botão **Ping**: chama `GET /status` do PlugNotas via server fn, mostra status HTTP + tempo.
     - Botão **Emitir NFC-e de teste**: cria em memória (não persiste em `orders`) um pedido fictício de R$ 0,01 com um item “PRODUTO TESTE HOMOLOGACAO” e roda a mesma pipeline; mostra chave, protocolo, link do PDF e link do XML retornados. Grava o resultado em `notas_fiscais` marcando `ambiente='homologacao'` para o log ficar rastreável.
     - Botão **Consultar última**: recupera status pela chave.
   - Zero risco de contaminar a numeração de produção: em `homologacao` a numeração é isolada (já é hoje pelos campos `numero_nfce_proximo`; nada muda).

4. **Erros e logs**
   - Padronizar retorno de erro: quando o PlugNotas devolver `{ error: [{ mensagem, campo }] }` (é o formato deles), concatenar em `RespostaEmissao.mensagem` e logar `console.error("[plugnotas]", status, body)` no server para aparecer em `server-function-logs`.
   - Nunca retornar a chave da API na resposta.

5. **Documentação curta na tela**
   - Texto na aba Fiscal indicando: (a) URL sandbox × produção; (b) que o header é `x-api-key`; (c) checklist de sandbox (empresa sincronizada ✓, certificado sincronizado ✓, ambiente = homologação ✓, ping ✓, NFC-e teste autorizada ✓).

## O que **não** entra nesse plano

- Cancelamento e carta de correção pela UI (fica para o próximo ciclo — o adapter já vai expor os métodos).
- Impressão do DANFE simplificado direto no cupom do Caixa (hoje já abre PDF em nova aba; suficiente para o sandbox).
- Job automático de polling de MDe (por enquanto continua manual via botão “Consultar DF-e” já existente).
- Troca de provedor (ACBr/Nativo): a arquitetura de adapters já isola isso; nada muda.

## Detalhes técnicos

- Arquivos alterados:
  - `src/lib/fiscal/adapters/tecnospeed.ts` → reescrito para PlugNotas (mantém o nome de classe para não quebrar `getAdapter`; opcionalmente renomear para `PlugNotasAdapter` e apontar o case `"tecnospeed"` para ele).
  - `src/lib/fiscal/engine.ts` → adicionar `sincronizarEmitente()` e `sincronizarCertificado()`; ajustar mapeamento de item para incluir `unidade`, `cest`, `pagamento[]` (a partir de `pagamentos_pedido`).
  - `src/lib/fiscal/fiscal.functions.ts` → novos server fns `pingProvedorFiscal`, `emitirNfceTeste`, `sincronizarCertificadoFiscal`, `sincronizarEmpresaFiscal` (todos com `requireSupabaseAuth` + checagem `has_role admin`).
  - `src/components/caixa/FiscalConfigTab.tsx` (usado hoje no Admin) → seção “Testes de Sandbox” + botões de sincronização + defaults de URL por ambiente.
  - `src/integrations/supabase/client.server.ts` já existe; usado dentro dos handlers para baixar o `.pfx`.
- Migration SQL:
  - `alter table public.config_fiscal add column certificado_provider_id text, add column certificado_sincronizado_em timestamptz, add column emitente_sincronizado_em timestamptz;`
  - Nenhuma mudança de RLS/GRANT (colunas herdam as políticas existentes de `config_fiscal`, já restritas por `can_manage_empresa`).
- Segredos: nenhum novo. A chave do PlugNotas continua sendo digitada em Admin → Fiscal (`config_fiscal.credenciais.api_key`) — cada empresa tem a própria (multi-tenant). Nada vai para `.env`.
- Testes manuais que farei ao final:
  1. `pingProvedorFiscal` → 200 em sandbox.
  2. Sincronizar empresa → 200/201.
  3. Sincronizar certificado A1 → 200 + `certificado_provider_id` gravado.
  4. Emitir NFC-e de teste → status `autorizada`, chave + PDF acessível.
  5. Consultar por chave → mesmo status.

Ao aprovar, executo em uma migration + uma rodada de edits e te devolvo pronto para colar a `api_key` do sandbox e clicar em “Emitir NFC-e de teste”.
