# Plano: Selar Release 1.9.0 ESTÁVEL

## Contexto
A última release estável selada foi a **1.8.0** (17/07/2026). Desde então foram entregues vários módulos novos e correções. O versionamento atual no código está em **1.8.1** com data 2026-07-17, mas ainda aponta a 1.8.0 como base do `STABLE_RELEASE`.

## Versão proposta
**1.9.0** — release Minor, justificada pelos novos módulos significativos entregues desde a 1.8.0:
- Triviano Garçom POS / Tap ON (pareamento, login por PIN, endpoints públicos, mesas, reconciliação)
- Módulo de Reservas e Fila de Espera (slots, recepção, rota pública /reservar)
- Recebimento de Ordens de Compra (conferência, NF, estoque, financeiro)
- Recálculo automático de CMV e botão "Recalcular CMV" no Admin
- Relatório de Ordem de Compra no padrão ReportShell A4
- BYOK — seleção de provedor de IA e chaves próprias por empresa
- Whitelabel Android — branding/ícone por empresa no POS app
- Múltiplas correções de segurança RLS e hardening de comandas/pedidos

## Entregáveis do plano

1. **Atualizar `src/lib/version.ts`**
   - `APP_VERSION`: `"1.9.0"`
   - `LAST_PATCH_DATE`: `"2026-07-22"`
   - `VERSION_STATUS`: `"ESTÁVEL"`
   - Reescrever `STABLE_RELEASE.validated` com os itens validados desde a 1.8.0 (manter os itens ainda válidos e adicionar os novos).
   - Atualizar `knownIssues` se houver pendências reconhecidas.

2. **Criar memory de release**
   - `.lovable/memory/releases/1.9.0-estavel.md` com changelog completo desde a 1.8.0.

3. **Atualizar índice de memórias**
   - `.lovable/memory/index.md`: adicionar referência à release 1.9.0 e, se for o caso, marcar a 1.8.0 como anterior.

4. **Limpar/renovar `.lovable/plan.md`**
   - O arquivo ainda contém o plano de "Recebimento de Ordens de Compra", que já foi implementado. Substituir por um resumo da release ou deixar em branco para o próximo ciclo.

5. **Validação técnica antes do selo**
   - Rodar `bun run build` para garantir que o projeto compila sem erros.
   - Rodar `security--run_security_scan` e resolver eventuais criticals (bloqueiam publicação).
   - Confirmar que as migrations locais estão aplicadas no banco (já verificado: sincronizadas até 20260721110957).

6. **Publicar**
   - Após build e scan aprovados, chamar `preview_ui--publish` para atualizar a publicação.

## Perguntas para você

1. **Concorda com a versão 1.9.0?** Ou prefere 1.8.2 (patch) ou 2.0.0 (major)?
2. **Há algum item que NÃO deve entrar na lista de validados** da release 1.9.0?
3. **Há algum bug/pendência que você gostaria de resolver antes de selar**, ou pode selar o estado atual?

Assim que confirmar, executo o plano.