## Veredicto sobre as 5 recomendações

### 1. Desativar botão direito e F12 — ❌ NÃO fazer
**Segurança teatral.** Qualquer pessoa abre DevTools por menu do navegador, atalho alternativo, ou simplesmente `view-source:`. Não impede pirataria (o JS já foi baixado pelo browser), atrapalha suporte técnico, quebra acessibilidade e passa imagem amadora. Grandes players (Stripe, Linear, Notion) não fazem isso. **Recomendo ignorar.**

### 2. Remover Source Maps — ✅ FAZER (rápido)
Source maps em produção expõem o código-fonte legível (nomes de variáveis, comentários, estrutura de pastas). Vamos garantir `build.sourcemap: false` no `vite.config.ts` para o build de produção. Mantemos em dev. **Ganho real e baixo custo.**

### 3. Auth Guard nas rotas /admin — ✅ JÁ ESTÁ (verificar e documentar)
Já implementado em `src/routes/_authenticated/route.tsx`: 
- Redireciona não-autenticados para `/auth`
- Checa `super_admin` para `/superadmin`
- Checa matriz de permissões (`canEnterAdmin`, `canEnterCaixa`) para `/admin` e `/caixa`
- Bypass só para `role: admin` em app_metadata

Ação: **auditar** se todas as sub-rotas administrativas realmente estão sob `_authenticated/` (não há duplicata pública) e revisar se cada server function sensível usa `requireSupabaseAuth` + checagem de role via `has_role`. Não vejo lacuna óbvia, mas vale um sweep.

### 4. RLS em TODAS as tabelas — ⚠️ PARCIALMENTE (auditar, não ativar cegamente)
Ativar RLS sem política = tabela travada (quebra o app). Ativar com política errada = vazamento. O correto é:
- Rodar `supabase--linter` + `security--get_table_schema` para listar tabelas **sem RLS** ou **sem policies**
- Para cada uma, decidir: multi-tenant por `empresa_id`? Por `user_id`? Público? Só service_role?
- Escrever policies + GRANTs corretos por tabela
- Confirmar que views sensíveis (ex: `view_products_public`) continuam invoker

Já temos RLS na maioria (visível no `supabase-tables`, todas mostram policies > 0). Preciso confirmar se **cobertura é 100%** e se as policies existentes realmente isolam por `empresa_id` (multi-tenant já está fechado conforme memórias, mas vale re-scan).

### 5. `.env` no `.gitignore` — ✅ JÁ ESTÁ (mas contexto importa)
No Lovable, `.env` é gerenciado pela plataforma e **não é commitado no repo GitHub sincronizado** — as chaves vão para Workspace Secrets. As chaves que aparecem no `.env` local são a **publishable/anon key** do Supabase, que é **pública por design** (protegida por RLS). O **service role key** nunca aparece nesse `.env` no Lovable Cloud (é injetado só no runtime do servidor). 

Ação: **verificar** o `.gitignore` do projeto para garantir que `.env` está listado, mas o risco real é baixo porque a única chave lá é pública.

---

## Plano de execução

### Passo 1 — Remover source maps de produção
Editar `vite.config.ts`:
```ts
build: { sourcemap: false }
```
Manter dev intacto.

### Passo 2 — Auditoria de segurança automatizada
Rodar em sequência (leitura, sem mudanças):
1. `security--run_security_scan` — pega findings ativos do scanner Lovable
2. `supabase--linter` — pega tabelas sem RLS, policies faltando, GRANTs errados
3. `security--get_table_schema` — mapa completo de RLS/policies por tabela

Gerar um **relatório consolidado** listando:
- Tabelas sem RLS habilitado
- Tabelas com RLS mas sem policies (efetivamente travadas)
- Policies com escopo suspeito (ex: `USING (true)` em tabela sensível)
- Server functions sem `requireSupabaseAuth`

### Passo 3 — Auditoria de rotas admin
Grep em `src/routes/` procurando arquivos administrativos fora de `_authenticated/`. Listar rotas + confirmar guard.

### Passo 4 — Verificar `.gitignore`
Confirmar `.env` listado. Se não, adicionar.

### Passo 5 — Apresentar relatório
Antes de qualquer correção de RLS, mostrar o que foi encontrado e propor um segundo plano cirúrgico por tabela (não vou ativar RLS em massa cegamente — respeita a memória `motor-financeiro-protegido`).

### O que NÃO farei
- ❌ Bloquear F12/menu de contexto (teatro)
- ❌ Ativar RLS em massa sem policies (quebra app)
- ❌ Mexer em triggers/RPCs financeiras sem plano específico aprovado
- ❌ Rotacionar chaves Supabase (não solicitado)

## Detalhes técnicos
- `vite.config.ts` está no root; edit único de 1 linha.
- Scanners retornam JSON estruturado, transformo em tabela markdown.
- Zero migração de banco neste plano — só leitura + config front.
