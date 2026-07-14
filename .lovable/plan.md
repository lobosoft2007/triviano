
# Análise dos dois cenários e Patch v1.7.3 — Salvaguardas de Mesa Ocupada + Multi-Device

## Cenário 1 — Cliente B escaneia a Mesa 3 enquanto A está consumindo

**Estado hoje (v1.7.2):**
1. B abre o QR → `abrir_solicitacao_mesa` cria APENAS uma linha em `solicitacoes_mesa` com status `aguardando`. Nada é incinerado nesse momento — a comanda de A segue intacta.
2. A solicitação de B aparece na Fila de Visto do Caixa (Cockpit).
3. **RISCO REAL:** se o operador clicar "Visto" sem perceber que a Mesa 3 já tem comanda viva, a `liberar_mesa` **cancela a comanda de A** (protocolo de incineração por MESA que acabamos de blindar) e abre uma nova em nome de B. Os pedidos que A já mandou para a cozinha viram `Cancelado` e o histórico do consumo do A é perdido da comanda ativa.
4. Se o operador **recusar**, tudo bem — nada muda.

**Ou seja:** a incineração automática protege contra o zumbi de ontem, mas transforma um clique errado no Cockpit em uma catástrofe operacional para a mesa ocupada.

### Salvaguarda proposta

**A) `liberar_mesa` passa a exigir confirmação explícita quando há comanda viva:**
- Novo parâmetro `p_forcar boolean DEFAULT false`.
- Se existir comanda `aberta`/`aguardando_fechamento` da MESA E `p_forcar = false`, a RPC **RAISE** com código tipado:
  `MESA_OCUPADA: comanda <uuid> já ativa (cliente: <nome>, R$ <total>)`.
- Só com `p_forcar = true` o Protocolo de Incineração roda. Todo o resto do fluxo de zumbi continua funcionando: comandas órfãs de dias anteriores ainda podem ser expurgadas, mas agora sempre com decisão consciente do operador.

**B) UI do Caixa (Cockpit — Fila de Visto):**
- Para cada solicitação, cruzar com `fechamentoMesas`/comandas vivas por número de mesa e, se houver conflito, o card aparece em **vermelho** com badge `MESA OCUPADA · Cliente atual: X · R$ Y`.
- Botão "Visto" desabilitado por padrão; substituído por dois botões:
  - `Anexar cliente à mesa` (v1.7.4, ainda não implementaremos — sinalizado como "em breve").
  - `Zerar mesa e começar do zero` → confirmação `AlertDialog` explicando que os pedidos atuais serão cancelados, e só então chama `liberarMesa(id, { forcar: true })`.
- Botão "Recusar" continua igual.

**C) Wrapper TypeScript:**
- `liberarMesa(id, { forcar?: boolean })` em `src/lib/mesa.ts`.
- Erro `MESA_OCUPADA` é interceptado no `.mutate` e renderiza o dialog acima. Nunca vira toast silencioso.

**D) Compatibilidade:**
- Chamadas antigas (sem `forcar`) mantêm o comportamento seguro por default (falham se ocupada). Nenhum código legado fica quebrado — o único chamador atual é o próprio Cockpit.

## Cenário 2 — Cliente A com celular sem bateria, loga em outro aparelho

**Estado hoje (v1.7.2):** **JÁ COBERTO** pela Reidratação de Sessão implementada.
- `rehydrateMesaSessionFromServer()` roda no boot do `AuthProvider` após o login.
- Lê `comanda_ativa` viva (`aberta`/`aguardando_fechamento`) do próprio usuário — o RLS já filtra por `user_id`.
- Restaura `MESA_COMANDA_KEY`/`MESA_NUMERO_KEY` no `localStorage` e dispara o `MESA_SESSION_EVENT` → o app inteiro (`useMesaSession`, carrinho, header camaleão) reage e volta para o modo Mesa apontando para a MESMA comanda.
- **Resultado:** A logando no celular do amigo vê "Minha Comanda" com os pedidos já enviados, pode continuar consumindo, pedir o fechamento e (quando quitar) receber cashback. Nenhum ajuste necessário — só precisamos validar em teste.

**Ressalva honesta:** o RLS restringe ao próprio `user_id`. Se A tinha aberto a mesa em modo convidado com outra conta, a reidratação só encontra a comanda se ele logar com a MESMA conta usada para abrir. Isso é intencional (segurança/privacidade) e alinhado com a doutrina — não vamos frouxar.

## Bumps e higiene

- `APP_VERSION → 1.7.3`, `LAST_PATCH_DATE = "2026-07-14"`.
- Adicionar à `STABLE_RELEASE.validated`:
  - `Trava anti-incineração acidental: liberar_mesa exige confirmação quando a mesa já tem comanda viva`.
  - `UI do Cockpit destaca mesa ocupada em vermelho e força AlertDialog antes de zerar`.
  - `Reidratação de Sessão validada em multi-device (A perde bateria e continua do mesmo comanda em outro aparelho)`.

## Arquivos afetados

- **Migração:** substituir `public.liberar_mesa(uuid)` por `public.liberar_mesa(uuid, boolean DEFAULT false)`; preservar todo o Protocolo de Incineração dentro do bloco `p_forcar`.
- **Frontend:**
  - `src/lib/mesa.ts` — assinatura de `liberarMesa` e parse do erro `MESA_OCUPADA`.
  - `src/routes/_authenticated/caixa.tsx` — cruzamento solicitação × comanda viva no Cockpit, badge vermelho, `AlertDialog` de confirmação, botão "Zerar mesa e começar do zero".
  - `src/lib/version.ts` — bump 1.7.3.

## Pergunta aberta antes de codar

- **Prioridade de UX:** hoje, se a comanda ocupada da mesa pertencer ao MESMO usuário que está pedindo (A escaneou o QR de novo por engano), a RPC continua exigindo `p_forcar`? Proponho: se `v_sol.user_id = comanda_viva.user_id`, **reaproveitar** a comanda existente automaticamente (sem incinerar), como um "check-in duplo" seguro. Isso preserva o consumo dele. Confirmam?
