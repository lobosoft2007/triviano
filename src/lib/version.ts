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

export const APP_VERSION = "1.8.1";
export const LAST_PATCH_DATE = "2026-07-17";
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
    "Impressão térmica direta (WebUSB/Web Serial) da conta da mesa, sem preview do navegador — com fallback para window.print()",
    "Pareamento e teste de impressora ESC/POS no Caixa → Configurações → Impressoras",
    "Troco em dinheiro no Finalizar e Receber (calcula e exibe troco, corta excesso antes de gravar, preserva motor financeiro)",
    "Hardening anti-pirataria: source maps desativados em produção (vite.config.ts) e .env bloqueado no .gitignore",
    "Auditoria de rotas admin/caixa/superadmin confirmada sob _authenticated/ com guards rígidos",
    "Trava anti-incineração acidental: liberar_mesa exige confirmação quando a mesa já tem comanda viva; check-in duplo do mesmo cliente reaproveita a comanda intacta",
    "Cockpit destaca mesa ocupada em vermelho e força AlertDialog antes de zerar",
    "Reidratação de Sessão validada em multi-device (usuário continua na mesma comanda em outro aparelho após login)",
    "Incineração da Comanda Zumbi: liberar_mesa cancela resíduos por MESA + índice único parcial impede comandas duplicadas vivas",
    "Reidratação de Sessão de Mesa: modo mesa persiste em localStorage e é restaurado do servidor no login",
    "Hardening do Realtime no Caixa: auto-reassinatura de canais + refetchOnWindowFocus na Fila de Visto e Fechamentos",
    "Branding v1.7.2: rótulo 'Desenvolvido por Triviano — v1.7.2' nos formulários e diálogos-chave",
    "Logout Seguro (Incineração de Contexto): redireciona p/ /auth + queryClient.clear() + volta a DELIVERY e limpa sessão de mesa",
    "Doutrina de Hospitalidade: sem pagamento no app no modo Mesa (botão só chama fechar_comanda e alerta o Caixa)",
    "PIX impresso corrigido: BR Code EMV com VALOR agregado (total_parcial) + dados PIX multi-tenant via get_pix_static_config",
    "Card da mesa Amarelo Pulsante + Beep ao pedir a conta (reconfirmado)",
    "Liquidação Unificada da Comanda (cobrança/QR único por mesa via total_parcial)",
    "Baixa atômica: webhook finaliza TODOS os pedidos da comanda de uma vez",
    "Botão 'Finalizar e Receber' no Caixa (um clique liquida a conta inteira)",
    "PIX agregado na 'Minha Comanda' do cliente",
    "Motor financeiro compartilhado (finalize_order_paid e _settle_comanda)",
    "Reorganização de Fluxos Estritos (Muro de Autenticação em / + contexto MESA/DELIVERY em localStorage)",
    "Botão Camaleão do carrinho e Ícone de QR-Code no Header",
    "Checkout fixado como Delivery (seletor verde removido, validação de endereço preservada)",
    "Cashback Dinâmico por Meio de Pagamento (percentual por meio + crédito manual do admin)",
    "Experiência de Mesa (QR assinado + Comanda + Fila de Visto + Fechamento)",
    "Painel Admin — Sidebar ERP (accordions filtrados por permissão)",
    "Isolamento Multi-Tenant de Admin",
    "Guards de Rota (Acesso Negado via URL)",
    "Módulo de Governança (Matriz de Permissões)",
    "Motor de Pagamento Mercado Pago (PIX dinâmico + baixa automática)",
    "Checkout App / Balcão / Mesas",
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
  ],
} as const;
