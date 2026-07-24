// ============================================================
// Estimativa de tempo de preparo + entrega
// ------------------------------------------------------------
// Wrapper fino em torno da RPC `calcular_estimativa_pedido` para
// que o PWA consulte a faixa estimada em tempo real conforme o
// carrinho muda. Toda a lógica pesada (linhas de produção, etapas,
// zonas de entrega, margem proporcional) vive no banco.
// ============================================================
import { supabase } from "@/integrations/supabase/client";

export interface EstimateResult {
  preparo_min: number;
  margem_min: number;
  entrega_min: number;
  faixa_min: number;
  faixa_max: number;
  total_cliente_min: number;
  hora_prevista_pronto: string | null;
}

export interface EstimateItemInput {
  product_id: string;
  quantity: number;
}

/**
 * Calcula a estimativa de tempo para uma lista de itens. Retorna `null`
 * quando o carrinho está vazio ou a RPC falha (sem quebrar o checkout).
 */
export async function estimateOrder(
  items: EstimateItemInput[],
  opts?: { empresaId?: string | null; zonaId?: string | null },
): Promise<EstimateResult | null> {
  const validItems = items.filter(
    (i) => i.product_id && Number.isFinite(i.quantity) && i.quantity > 0,
  );
  if (validItems.length === 0) return null;

  const { data, error } = await supabase.rpc("calcular_estimativa_pedido", {
    p_items: validItems as unknown as never,
    p_empresa_id: opts?.empresaId ?? null,
    p_zona_id: opts?.zonaId ?? null,
  });

  if (error) {
    console.warn("estimateOrder falhou:", error.message);
    return null;
  }

  const raw = (data ?? {}) as Partial<EstimateResult>;
  return {
    preparo_min: Number(raw.preparo_min ?? 0),
    margem_min: Number(raw.margem_min ?? 0),
    entrega_min: Number(raw.entrega_min ?? 0),
    faixa_min: Number(raw.faixa_min ?? 0),
    faixa_max: Number(raw.faixa_max ?? 0),
    total_cliente_min: Number(raw.total_cliente_min ?? 0),
    hora_prevista_pronto: raw.hora_prevista_pronto ?? null,
  };
}
