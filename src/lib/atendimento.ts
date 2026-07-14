/**
 * Contexto global de atendimento do PWA (v1.6.0).
 *
 * O app opera em dois modos mutuamente exclusivos:
 *  - "DELIVERY": fluxo padrão → carrinho leva ao /checkout (PIX/Cartão online).
 *  - "MESA":     ativado ao ler o QR de uma mesa → carrinho envia direto para a
 *                cozinha via `enviar_pedido_mesa` e abre a "Minha Comanda".
 *
 * Persistência em `localStorage` (decisão do conselho de engenharia): o
 * contexto de MESA precisa sobreviver ao fechamento do navegador ou à descarga
 * do aparelho até que a comanda seja encerrada. A leitura acontece apenas no
 * cliente (pós-hidratação) para não gerar mismatch de SSR.
 */

export type StatusAtendimento = "DELIVERY" | "MESA";

export const STATUS_ATENDIMENTO_KEY = "status_atendimento";

/** Evento disparado quando o contexto de atendimento muda. */
export const ATENDIMENTO_EVENT = "atendimento-change";

export function getStatusAtendimento(): StatusAtendimento {
  try {
    const raw = localStorage.getItem(STATUS_ATENDIMENTO_KEY);
    return raw === "MESA" ? "MESA" : "DELIVERY";
  } catch {
    return "DELIVERY";
  }
}

export function setStatusAtendimento(status: StatusAtendimento): void {
  try {
    localStorage.setItem(STATUS_ATENDIMENTO_KEY, status);
    window.dispatchEvent(new Event(ATENDIMENTO_EVENT));
  } catch {
    /* ignore storage errors */
  }
}

/** Volta ao modo padrão (delivery) — usado no logout / fechamento da comanda. */
export function resetStatusAtendimento(): void {
  setStatusAtendimento("DELIVERY");
}
