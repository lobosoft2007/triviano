# Fase 4 — Controle de Acesso Físico (com refino UX SOTA)

Blindagem de acesso ponta a ponta reusando a Matriz de Permissões já carregada. **Sem mexer em banco, RPC ou regra de negócio** — só navegação e guarda no front-end.

## Diagnóstico (o que já existe)

- **Carregamento de chaves (Passo 1): PRONTO.** `usePermissions()` chama `get_my_permissions` (resolve `profiles.nivel_id → permissoes_matriz`) e devolve todas as flags. `is_admin` fura a matriz.
- **Higiene de menus (Passo 2): PARCIAL.** `/admin` já filtra abas por `TABS.filter(tabAllowed)`; `/caixa` já condiciona cada `TabButton`. Falta padronizar e cobrir 100% dos itens.
- **Lacunas:** `route.tsx` só checa login; não há URL por módulo (deep-link não interceptável); não há `toast.error` de acesso negado; não há landing inteligente por nível.

## Arquitetura de guarda (2 camadas)

```text
  /caixa  /admin  /superadmin        <- URLs reais  => Camada 1 (route.tsx)
     |       |                        (bloqueio de porta por superfície)
     +---- ?tab=financeiro -----+     <- deep-link   => Camada 2 (página)
             abas internas            (bloqueio de módulo + toast)
```

## Passo 1 — Higiene Visual (Sidebar/Menus) — refino UX

- Confirmar que **todos** os itens de menu do `/admin` e `/caixa` só renderizam quando a flag correspondente for `true` (via `usePermissions`). Nenhum botão de módulo proibido deve aparecer, nem mesmo desabilitado.
- Auditoria por item:
  - `/admin`: já usa `TABS.filter(tabAllowed)` + mapa `TAB_FLAG`. Revisar cada linha do `TAB_FLAG` e o botão "Painel Master" (só `super_admin`).
  - `/caixa`: revisar cada `TabButton` e cada ação (Sangria/Suprimento/Recebimento/Estoque) para garantir gate por flag (`canSangria`, `canFinanceiro`, `canEstoque`, `isMaster`, etc.).
- Centralizar a lógica no `permissions.ts` para evitar divergência entre as duas telas.

## Passo 2 — Default Landing inteligente — refino UX

- Criar helper `firstAllowedRoute(perms)` em `src/lib/permissions.ts` que devolve a rota inicial ideal do usuário conforme suas flags. Ordem de prioridade (staff):
  - `super_admin` → `/superadmin`
  - `is_admin` → `/caixa` (ou `/admin`)
  - `acesso_kds_cozinha` / `acesso_bar` → `/caixa?tab=...` (Cozinheiro cai no KDS, Barman no Bar)
  - `acesso_atendimento_balcao`/`acesso_mesas`/`acesso_delivery` → `/caixa`
  - `acesso_financeiro`/`acesso_entrada_estoque`/etc. → `/admin?tab=<primeira permitida>`
  - cliente comum (sem flags de staff) → `/` (PWA cliente)
- Aplicar esse helper:
  - Após login e no redirect pós-`post_login_redirect`, se o destino padrão não for permitido, cair no `firstAllowedRoute`.
  - Dentro de `/admin` e `/caixa`, a aba inicial já respeita permissão; alinhar com o helper para consistência (Cozinheiro entra direto na aba KDS).

## Passo 3 — Blindagem de Rotas

### `src/routes/_authenticated/route.tsx` (Camada 1 — porta)
- No `beforeLoad`, além do check de sessão, buscar `get_my_permissions` **apenas** para caminhos sensíveis:
  - `/superadmin` → exige `super_admin`; senão `redirect` para `firstAllowedRoute`.
  - `/admin` → exige ao menos uma aba permitida; senão `redirect` para `firstAllowedRoute` com `search: { denied: "admin" }`.
  - `/caixa` → exige `canEnterCaixa`; senão `redirect` com `search: { denied: "caixa" }`.
- Admin da empresa e super_admin passam direto. O toast é disparado no destino (Passo 4).

### `src/lib/permissions.ts` (helpers compartilhados)
- `ACCESS_DENIED_MSG = "Acesso negado: sua função não permite esta operação."`
- `CAIXA_TAB_FLAG` (espelho do `TAB_FLAG` do admin) para abas do caixa.
- `firstAllowedRoute(perms)` (Passo 2).

## Passo 3 (páginas) — Camada 2 (módulo/deep-link)

### `src/routes/_authenticated/admin.tsx`
- `validateSearch` p/ aceitar `?tab=<AdminTab>` e `?denied=`.
- Inicializar aba pelo `?tab=` quando permitido (senão `firstAllowedRoute`/1ª aba).
- Substituir o auto-jump silencioso por: aba pedida não permitida → `toast.error(ACCESS_DENIED_MSG)` uma vez + cair na 1ª aba liberada.

### `src/routes/_authenticated/caixa.tsx`
- `validateSearch` p/ `?tab=` das abas do caixa + `?denied=`.
- `useEffect` de enforcement (hoje só existe no admin) com `CAIXA_TAB_FLAG`: aba proibida via URL → `toast.error(ACCESS_DENIED_MSG)` + voltar à 1ª permitida.

## Passo 4 — Feedback visual (toast)

- Mensagem única `ACCESS_DENIED_MSG`.
- Disparada em: (a) `useEffect` que lê `search.denied` no destino do redirect (limpa o param depois); (b) tentativa de aba proibida via `?tab=`.

## Arquivos a alterar

1. `src/routes/_authenticated/route.tsx` — guarda de porta + redirect p/ `firstAllowedRoute` com `denied`.
2. `src/lib/permissions.ts` — `ACCESS_DENIED_MSG`, `CAIXA_TAB_FLAG`, `firstAllowedRoute`.
3. `src/routes/_authenticated/admin.tsx` — `?tab=`/`?denied=` + toast + higiene de menu confirmada.
4. `src/routes/_authenticated/caixa.tsx` — `?tab=`/`?denied=` + `useEffect` enforcement + toast + higiene de menu/ações.
5. `src/routes/index.tsx` — landing: se o cliente/staff cair aqui sem ser destino ideal, redirecionar via `firstAllowedRoute`; ler `search.denied` p/ toast.
6. (se necessário) `src/routes/auth.tsx` — aplicar `firstAllowedRoute` no redirect pós-login.

## Fora de escopo (estabilidade)

- Sem migração/RPC/`user_roles`/`permissoes_matriz`.
- Sem tocar em regra de negócio (pagamentos, pedidos, estoque).
- Superadmin (Triviano) e Admin da empresa mantêm acesso total à sua esfera.

## Verificação

- Simular 3 níveis (Cozinheiro, Financeiro, Garçom) no preview:
  - Menus mostram só o permitido (nada de botão proibido).
  - Login de Cozinheiro cai direto no KDS; Financeiro em `/admin` na aba Financeiro.
  - `/admin?tab=financeiro` sem `acesso_financeiro` → 1ª aba + toast.
  - `/caixa`/`/admin`/`/superadmin` sem permissão → redirect p/ `firstAllowedRoute` + toast.
  - Admin/super_admin passam direto.
