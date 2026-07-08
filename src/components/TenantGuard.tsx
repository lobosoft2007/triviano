import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useScope } from "@/hooks/useScope";
import { empresaQueryOptions } from "@/lib/empresa";

/**
 * Guarda de tenant (estratégia "bancos gêmeos": 1 projeto = 1 restaurante).
 *
 * Quando o endereço acessado carrega um slug de subdomínio no padrão da
 * Triviano (ex.: `clube23-app.triviano.com.br` → slug "clube23"), este guard
 * confirma que o slug corresponde ao restaurante servido por ESTE ambiente
 * (coluna `empresas.subdominio`). Se não corresponder, o visitante caiu no
 * projeto errado — mostramos um aviso claro em vez de servir o cardápio de
 * outro estabelecimento.
 *
 * Domínios próprios do cliente (ex.: `adm.clube23.com.br`) e o namespace da
 * holding não carregam slug, então passam direto sem verificação.
 */
export function TenantGuard({ children }: { children: React.ReactNode }) {
  const { tenantSlug, hydrated } = useScope();
  const { data: empresa, isLoading } = useQuery(empresaQueryOptions);

  const expected = empresa?.subdominio?.trim().toLowerCase() || null;
  const requested = tenantSlug?.trim().toLowerCase() || null;

  // Só bloqueia quando temos ambos os lados resolvidos e eles divergem.
  const mismatch =
    hydrated && !isLoading && requested !== null && expected !== null && requested !== expected;

  console.log("[TENANT] guard →", { hydrated, isLoading, requested, expected, mismatch });

  if (mismatch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-float">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="font-display text-xl font-bold">Endereço não encontrado</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            O endereço <span className="font-semibold text-foreground">{requested}</span> não
            corresponde a este estabelecimento
            {empresa?.nome_fantasia ? (
              <>
                {" "}(
                <span className="font-semibold text-foreground">{empresa.nome_fantasia}</span>)
              </>
            ) : null}
            . Verifique o link e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
