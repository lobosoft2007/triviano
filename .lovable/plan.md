
# v1.7.2 — Execução (homologada)

Migração SQL já aplicada com sucesso:
- Coluna `motivo_cancelamento` adicionada em `comanda_ativa`.
- Limpeza única do legado: comandas duplicadas vivas incineradas (a mais recente por mesa foi mantida; as demais viraram `cancelada` com pedidos pendentes desvinculados) — a Mesa 3 já nasce limpa.
- Índice único parcial `uq_comanda_ativa_mesa_viva` criado — bloqueio físico contra duas comandas vivas na mesma mesa.
- `liberar_mesa` reescrita com Protocolo de Incineração por MESA (cancela qualquer resíduo antes de INSERT da nova comanda em R$ 0,00).

Falta liberar os edits de código abaixo (aprove o plano para eu aplicar):

## Arquivos a editar

**1. `src/lib/mesa.ts` — Reidratação + persistência real**
- Trocar `sessionStorage` → `localStorage` em `getMesaSession`/`setMesaSession`/`clearMesaSession`.
- Migração transparente: se houver chave antiga em `sessionStorage`, move para `localStorage` e limpa a antiga.
- Novo helper `rehydrateMesaSessionFromServer()` — se não houver sessão local, procura `comanda_ativa` viva do usuário logado e restaura o "modo mesa".

**2. `src/lib/auth.tsx` — Reidratação no boot**
- Após `validateSession` confirmar `user`, chamar `void rehydrateMesaSessionFromServer()` (silencioso, não bloqueia login). Preserva `signOut()` já com `clearMesaSession()` + `resetStatusAtendimento()`.

**3. `src/routes/_authenticated/caixa.tsx` — Hardening Realtime**
- Nos canais `caixa-orders` e `caixa-mesas`: `.subscribe((status) => …)` com reassinatura + backoff em `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`.
- Adicionar `refetchOnWindowFocus: true` e reduzir `refetchInterval` para 8 s nas queries `mesa-solicitacoes` e `mesa-fechamentos`.
- Beep de entrada já implementado (linha 657) — apenas reconfirmar comportamento.

**4. `src/components/PoweredByBadge.tsx` — Novo componente**
- Renderiza discretamente `Desenvolvido por Triviano — v{APP_VERSION}` (lê de `src/lib/version.ts`, cor `text-muted-foreground`, `text-[10px]`).

**5. Inclusão do badge nos formulários**
- `src/routes/auth.tsx`, `src/routes/auth_.update-password.tsx`, `src/routes/reset-password.tsx`, `src/routes/checkout.tsx`, `src/routes/perfil.tsx`, `src/routes/mesa.tsx`, `src/components/caixa/ComandaPaymentDialog.tsx`, `src/components/caixa/PaymentDialog.tsx`, `src/components/caixa/OrderEditDialog.tsx`.

**6. `src/lib/version.ts` — Bump**
- `APP_VERSION = "1.7.2"`, `LAST_PATCH_DATE = "2026-07-14"`.
- `STABLE_RELEASE.validated`: adicionar "Incineração da Comanda Zumbi (Protocolo por MESA + índice único)", "Reidratação de Sessão de Mesa via localStorage", "Hardening do Realtime no Caixa" e "Branding v1.7.2 nos formulários".

Motor financeiro (`_settle_comanda`, `finalize_order_paid`, `finalize_comanda_paid`, webhook MP, RLS/GRANT) permanece intocado — respeita `mem://constraints/motor-financeiro-protegido`.
