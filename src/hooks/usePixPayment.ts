import { useMemo, useState, useCallback } from "react";
import {
  generatePixPayload,
  type PixPayloadParams,
} from "@/lib/pixPayment";

/**
 * Dados fixos do recebedor PIX deste estabelecimento.
 *
 * NOTA DE PRODUÇÃO: na fase de produção, em vez de montar o BR Code
 * localmente com estes dados estáticos, este hook deverá fazer uma
 * chamada de API (fetch/POST) para o endpoint do Banco / gateway de
 * pagamento, enviando o valor do pedido e recebendo de volta:
 *   - a string oficial do BR Code (Copia e Cola);
 *   - a imagem/payload do QR Code;
 *   - o txid da cobrança (para conciliação via WEBHOOK em tempo real).
 * O webhook de confirmação então fará a baixa automática do pedido.
 */
export const PIX_RECEIVER = {
  pixKey: "21993383918",
  merchantName: "Marcello R L Assumpcao",
  merchantCity: "MARICA",
} as const;

export interface UsePixPaymentResult {
  /** String do PIX Copia e Cola (BR Code) já com CRC16 válido. */
  payload: string;
  /** Indica se o último "copiar" foi bem-sucedido (para feedback de UI). */
  copied: boolean;
  /** Copia o BR Code para a área de transferência. */
  copy: () => Promise<boolean>;
}

/**
 * Hook que isola a geração do PIX Copia e Cola e a cópia para a área de
 * transferência. Centraliza a lógica de pagamento para facilitar a
 * futura troca por uma integração de API/gateway com baixa automática.
 */
export function usePixPayment(
  amount: number,
  overrides?: Partial<PixPayloadParams>,
): UsePixPaymentResult {
  const [copied, setCopied] = useState(false);

  const payload = useMemo(
    () =>
      generatePixPayload({
        ...PIX_RECEIVER,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        ...overrides,
      }),
    [amount, overrides],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      return false;
    }
  }, [payload]);

  return { payload, copied, copy };
}
