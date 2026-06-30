import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  generatePixPayload,
  type PixPayloadParams,
} from "@/lib/pixPayment";
import { fetchActivePixConfig } from "@/lib/erp";

/**
 * Dados de fallback do recebedor PIX, usados apenas quando ainda não há
 * uma configuração ativa cadastrada em `config_pagamentos`.
 *
 * NOTA DE PRODUÇÃO: na fase de produção, em vez de montar o BR Code
 * localmente com a chave/nome/cidade da configuração, este hook deverá
 * fazer uma chamada de API (fetch/POST) para o endpoint do Banco / gateway
 * (cujas credenciais `client_id` / `client_secret` já vivem em
 * `config_pagamentos`), recebendo de volta:
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
  /** Nome do recebedor efetivamente usado (config ativa ou fallback). */
  merchantName: string;
  /** Cidade do recebedor efetivamente usada. */
  merchantCity: string;
  /** Indica se o último "copiar" foi bem-sucedido (para feedback de UI). */
  copied: boolean;
  /** Copia o BR Code para a área de transferência. */
  copy: () => Promise<boolean>;
}

/**
 * Hook que isola a geração do PIX Copia e Cola e a cópia para a área de
 * transferência. Os dados do recebedor (chave, nome, cidade) são buscados
 * dinamicamente da configuração de pagamento ativa; havendo falha ou
 * ausência de configuração, recai sobre os valores de fallback.
 */
export function usePixPayment(
  amount: number,
  overrides?: Partial<PixPayloadParams>,
): UsePixPaymentResult {
  const [copied, setCopied] = useState(false);

  const { data: activeConfig } = useQuery({
    queryKey: ["active-pix-config"],
    queryFn: fetchActivePixConfig,
    staleTime: 1000 * 60 * 5,
  });

  const receiver = useMemo(() => {
    const cfg = activeConfig;
    return {
      pixKey: cfg?.chave_pix_padrao?.trim() || PIX_RECEIVER.pixKey,
      merchantName: cfg?.nome_recebedor?.trim() || PIX_RECEIVER.merchantName,
      merchantCity: cfg?.cidade_recebedor?.trim() || PIX_RECEIVER.merchantCity,
    };
  }, [activeConfig]);

  const payload = useMemo(
    () =>
      generatePixPayload({
        ...receiver,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        ...overrides,
      }),
    [receiver, amount, overrides],
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

  return {
    payload,
    merchantName: receiver.merchantName,
    merchantCity: receiver.merchantCity,
    copied,
    copy,
  };
}
