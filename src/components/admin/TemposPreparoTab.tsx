import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Layers3, Save } from "lucide-react";
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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["empresa-tempo-entrega-padrao"],
    queryFn: getTempoEntregaPadrao,
  });
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data !== undefined) setValue(String(data));
  }, [data]);

  async function handleSave() {
    setSaving(true);
    try {
      await setTempoEntregaPadrao(Number(value) || 0);
      await refetch();
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
        ) : (
          <div className="flex items-end gap-3">
            <div className="w-40 space-y-1.5">
              <Label htmlFor="tempo-padrao">Minutos</Label>
              <Input
                id="tempo-padrao"
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
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
