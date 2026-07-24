import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Layers3, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getTempoEntregaPadrao,
  setTempoEntregaPadrao,
} from "@/lib/tempos-admin";
import { LinhasProducaoCrud } from "@/components/admin/LinhasProducaoCrud";
import { ZonasEntregaCrud } from "@/components/admin/ZonasEntregaCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TemposPreparoTab() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["empresa-tempo-entrega-padrao"],
    queryFn: getTempoEntregaPadrao,
    staleTime: 30_000,
  });
  // null = "não digitou ainda, mostra o cache"; string = valor sendo editado.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const displayValue =
    draft ?? (data !== undefined ? String(data) : "");

  async function handleSave() {
    setSaving(true);
    try {
      await setTempoEntregaPadrao(Number(displayValue) || 0);
      await refetch();
      setDraft(null); // volta a refletir o cache atualizado
      toast.success("Tempo padrão atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Layers3 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Linhas de Produção</h2>
      </header>
      <p className="text-sm text-muted-foreground">
        Cada linha de produção representa um funcionário/estação que trabalha em
        paralelo. Com 1 funcionário, use 1 linha para tudo (a cozinha faz um
        item de cada vez). Com 2 funcionários, crie 2 linhas (ex.: Pizza e
        Burger) e distribua as categorias — elas preparam simultaneamente. O
        tempo de cada etapa é definido dentro de cada categoria.
      </p>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 font-display text-sm font-bold">
          Tempo de entrega padrão
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Usado quando o pedido não tem zona de entrega definida. Pedidos de
          mesa/balcão ignoram este valor.
        </p>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Não foi possível carregar o tempo atual.
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="ml-auto"
            >
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="w-40 space-y-1.5">
              <Label htmlFor="tempo-padrao">Minutos</Label>
              <Input
                id="tempo-padrao"
                type="number"
                min={0}
                value={displayValue}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        )}
      </section>

      <LinhasProducaoCrud />
      <ZonasEntregaCrud />
    </div>
  );
}

