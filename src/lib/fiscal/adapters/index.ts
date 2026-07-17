import type { FiscalAdapter, FiscalProvider } from "@/lib/fiscal/types";
import { TecnospeedAdapter } from "@/lib/fiscal/adapters/tecnospeed";

const adapters: Record<FiscalProvider, () => FiscalAdapter> = {
  tecnospeed: () => new TecnospeedAdapter(),
  acbr: () => {
    throw new Error("Adapter ACBr ainda não implementado.");
  },
  nativo: () => {
    throw new Error("Emissão nativa ainda não implementada.");
  },
};

export function getAdapter(provider: FiscalProvider): FiscalAdapter {
  const factory = adapters[provider];
  if (!factory) {
    throw new Error(`Provedor fiscal não suportado: ${provider}`);
  }
  return factory();
}
