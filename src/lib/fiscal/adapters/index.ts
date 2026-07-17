import type { FiscalAdapter, FiscalProvider } from "@/lib/fiscal/types";
import { TecnospeedAdapter, type TecnospeedCredentials } from "@/lib/fiscal/adapters/tecnospeed";

export type { TecnospeedCredentials };

export function getAdapter(
  provider: FiscalProvider,
  cred?: TecnospeedCredentials,
): FiscalAdapter {
  switch (provider) {
    case "tecnospeed":
      return new TecnospeedAdapter(cred);
    case "acbr":
      throw new Error("Adapter ACBr ainda não implementado.");
    case "nativo":
      throw new Error("Emissão nativa ainda não implementada.");
    default:
      throw new Error(`Provedor fiscal não suportado: ${provider}`);
  }
}
