// ============================================================================
// Protocolo de Versionamento Sequencial SOTA — trivIAno
// ============================================================================
// Regras de gestão deste arquivo:
//
// 1. APP_VERSION segue o padrão Major.Minor.Patch (ex.: '1.0.1').
// 2. LAST_PATCH_DATE registra a data (YYYY-MM-DD) do último incremento de patch.
//
// Lógica do Patch (Sequencial Diário):
//   - A cada Publish/Deploy, comparar a data de hoje com LAST_PATCH_DATE.
//   - Se hoje > LAST_PATCH_DATE: incrementar o Patch (+1) e atualizar
//     LAST_PATCH_DATE para hoje.
//   - Vários deploys no MESMO dia NÃO alteram o número. Só muda no primeiro
//     deploy do dia seguinte.
//
// Reset de Ciclo:
//   - Ao alterar manualmente o Major (1º número) ou o Minor (2º número),
//     o Patch volta automaticamente para 1.
// ============================================================================

export const APP_VERSION = "1.0.1";
export const LAST_PATCH_DATE = "2026-07-11";
export const VERSION_STATUS = "ESTÁVEL";

/** Rótulo pronto para exibição, ex.: "v1.0.1". */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

/** Registro de release estável — ponto de retorno seguro. */
export const STABLE_RELEASE = {
  version: APP_VERSION,
  status: VERSION_STATUS,
  date: LAST_PATCH_DATE,
  safeRollback: true,
  validated: [
    "PIX (pago)",
    "Dinheiro",
    "Carrinho persistente",
    "Rascunhos",
    "Webhook",
    "Trigger de bloqueio",
    "Versionamento",
  ],
  knownIssues: [
    "Rascunhos órfãos desaparecem quando novo pedido é criado",
    "Isolamento de tenants (admin vê pedidos do cliente)",
  ],
} as const;
