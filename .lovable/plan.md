# Gestão de Equipe e Controle de Acesso — Etapa 1 (Diagnóstico + Plano)

## Parte A — Diagnóstico: como os cargos funcionam hoje

O sistema **não usa cargos fixos** hoje. Ele tem duas camadas separadas:

### 1. Papéis técnicos (tabela `user_roles`)
São apenas 3, definidos no enum `app_role`:
- `super_admin` — dono da plataforma (Triviano)
- `admin` — operador da empresa (todo funcionário recebe este papel ao ser criado)
- `user` — cliente final do delivery

Ou seja: **todo funcionário é `admin` tecnicamente**. Isso não é o "cargo" dele.

### 2. Níveis de acesso (o "cargo" real, tabela `niveis_acesso`)
Cada empresa cria seus próprios níveis livremente. Hoje a empresa exemplo tem:
- **Gerente**
- **Operador de caixa**

Cada nível tem uma **matriz de permissões** (tabela `permissoes_matriz`) com **8 chaves liga/desliga**:

```text
acesso_kds_cozinha          acesso_entrada_estoque
acesso_atendimento_balcao   acesso_sangria_suprimento
acesso_mesas                acesso_cadastro_produtos
acesso_delivery             acesso_financeiro
```

- `profiles.nivel_id` → aponta o funcionário para o nível/cargo dele.
- **Admin Master** = `admin` com `profiles.nivel_id IS NULL` → vê tudo (bypassa a matriz).

### 3. Onde o front-end decide o que cada um vê
- `src/lib/permissions.ts` → hook `usePermissions()` chama a função `get_my_permissions()` no banco e devolve as 8 flags + `is_admin`.
- `src/routes/_authenticated/caixa.tsx` (linhas ~279-285) → decide abas do Caixa: `canDelivery`, `canMesas`, `canBalcao`, `canFinanceiro`, `canSangria`, `canEstoque`.
- `src/routes/_authenticated/admin.tsx` (linhas ~248-261) → mapeia cada aba da Retaguarda para uma flag.
- `src/components/admin/FuncionariosTab.tsx` + `PermissoesTab.tsx` → o Master cria níveis, liga/desliga flags e vincula funcionários.

**Conclusão:** os cargos que você quer (Cozinheiro, Garçom etc.) já podem existir como *nomes de nível*, mas hoje precisam ser criados manualmente e configurados chave por chave. Faltam também 2 áreas que **nenhuma flag cobre**: **RH/Gestão de Equipe** e **Entregador/rota de entrega**.

---

## Parte B — Plano de expansão (faseado, sem quebrar nada)

Objetivo: transformar os 7 cargos (**Admin, Financeiro, RH, Cozinheiro, Garçom, Barman, Entregador**) em **modelos prontos (presets)** que já vêm com a matriz configurada, mantendo a flexibilidade atual.

### Fase 1 — (esta etapa) Só diagnóstico e aprovação
Nenhuma alteração. Você aprova o desenho abaixo antes de qualquer código.

### Fase 2 — Ampliar a matriz de permissões (banco)
Adicionar 2 flags novas à `permissoes_matriz` + `get_my_permissions()` (default `false`, sem impacto nos níveis atuais):
- `acesso_rh` — Gestão de Equipe (funcionários, cargos, permissões)
- `acesso_entregas` — painel do Entregador (pedidos prontos / em rota)

### Fase 3 — Presets de cargo (banco + UI de criação)
Ao criar um nível, oferecer um **modelo de cargo** que já preenche a matriz:

```text
Cargo         | Permissões ligadas por padrão
--------------|-----------------------------------------------------------
Admin         | tudo (equivale ao Master, porém como nível)
Financeiro    | acesso_financeiro, acesso_sangria_suprimento
RH            | acesso_rh
Cozinheiro    | acesso_kds_cozinha
Garçom        | acesso_mesas, acesso_atendimento_balcao
Barman        | acesso_kds_cozinha (bar) — a definir se separa cozinha x bar
Entregador    | acesso_entregas, acesso_delivery (somente leitura da rota)
```

O Master continua podendo ajustar qualquer chave depois — o preset é só o ponto de partida.

### Fase 4 — Refletir os cargos no front-end
- Caixa/Retaguarda: passar a respeitar `acesso_rh` e `acesso_entregas`.
- (Opcional, etapa futura) Criar telas dedicadas: painel do Entregador e painel de RH.

---

## Decisões que preciso de você antes da Fase 2

1. **"Admin" como cargo** — você quer um cargo "Admin" (nível que vê tudo) além do Admin Master já existente, ou o Master já resolve isso?
2. **Barman vs Cozinheiro** — hoje há uma única flag de cozinha (`acesso_kds_cozinha`). Já existem switches de monitor cozinha/bar/pizzaria em `empresas`. Quer separar Barman em uma permissão própria (`acesso_bar`) ou manter junto com a cozinha?
3. **Escopo desta rodada** — devo parar na **Fase 2 + 3** (matriz nova + presets prontos na criação de cargos) e deixar telas dedicadas de RH/Entregador para depois? Recomendo sim, pela estabilidade.

## Detalhes técnicos (referência)
- Migração: `ALTER TABLE permissoes_matriz ADD COLUMN acesso_rh boolean NOT NULL DEFAULT false, ADD COLUMN acesso_entregas boolean NOT NULL DEFAULT false;` + atualizar `get_my_permissions()`, `seed_permissoes_matriz()`, `PermissionFlag` em `src/lib/permissions.ts`, `FLAGS`/`PERMISSION_LABELS` e a UI de `PermissoesTab.tsx`.
- Presets: um mapa `CARGO_PRESETS` no front + parâmetro opcional na criação do nível para aplicar a matriz inicial.
- Nada muda em `user_roles`/`app_role` — a arquitetura de papéis técnicos permanece intacta.
