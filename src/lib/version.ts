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

export const APP_VERSION = "1.9.0";
export const LAST_PATCH_DATE = "2026-07-22";
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
    "Release 1.9.0 — selada em 22/07/2026",
    "BYOK para IA: cada empresa pode usar sua própria chave de OpenAI/Groq/Gemini no Admin → Relatórios → Configuração de IA",
    "Triviano Garçom POS / Tap ON: pareamento de dispositivo Android via código no Admin, login por PIN 4 dígitos, endpoints públicos seguros",
    "Tap ON: abertura de mesa, visualização de comandas, reconciliação diária de cobranças tap_card/tap_pix",
    "Módulo de Reservas e Fila de Espera: slots de 30min, capacidade, walk-in, check-in, painel de recepção e rota pública /reservar",
    "Recebimento de Ordens de Compra: conferência item a item, com/sen NF, atualização de saldo e custo, lançamento financeiro automático",
    "Recálculo automático de CMV: _compute_product_custo_total + botão 'Recalcular CMV' no Admin → Cardápio",
    "Relatório de Ordem de Compra no padrão ReportShell A4 com cabeçalho/rodapé repetidos e paginação correta",
    "Whitelabel Android: branding/ícone/nome do app por empresa no POS app",
    "Hardening RLS: comanda_ativa e reservas com políticas separadas cliente/staff; orders com escopo de empresa no select do cliente",
    "Impressão térmica direta (WebUSB/Web Serial) da conta da mesa, sem preview do navegador — com fallback para window.print()",
    "Pareamento e teste de impressora ESC/POS no Caixa → Configurações → Impressoras",
    "Troco em dinheiro no Finalizar e Receber (calcula e exibe troco, corta excesso antes de gravar, preserva motor financeiro)",
    "Hardening anti-pirataria: source maps desativados em produção (vite.config.ts) e .env bloqueado no .gitignore",
    "Auditoria de rotas admin/caixa/superadmin confirmada sob _authenticated/ com guards rígidos",
    "Trava anti-incineração acidental: liberar_mesa exige confirmação quando a mesa já tem comanda viva; check-in duplo do mesmo cliente reaproveita a comanda intacta",
    "Cockpit destaca mesa ocupada em vermelho e força AlertDialog antes de zerar",
    "Reidratação de Sessão validada em multi-device (usuário continua na mesa comanda em outro aparelho após login)",
    "Incineração da Comanda Zumbi: liberar_mesa cancela resíduos por MESA + índice único parcial impede comandas duplicadas vivas",
    "Reidratação de Sessão de Mesa: modo mesa persiste em localStorage e é restaurado do servidor no login",
    "Hardening do Realtime no Caixa: auto-reassinatura de canais + refetchOnWindowFocus na Fila de Visto e Fechamentos",
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
