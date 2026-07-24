import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EtapaPreparo } from "@/lib/tempos-admin";

interface Props {
  etapas: EtapaPreparo[];
  onChange: (next: EtapaPreparo[]) => void;
}

export function EtapasPreparoEditor({ etapas, onChange }: Props) {
  const totalMin = etapas.reduce((s, e) => s + (Number(e.duracao_min) || 0), 0);
  const gargalo = etapas.reduce(
    (m, e) => Math.max(m, Number(e.duracao_min) || 0),
    0,
  );

  function update(idx: number, patch: Partial<EtapaPreparo>) {
    const next = etapas.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange(next);
  }
  function remove(idx: number) {
    onChange(etapas.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= etapas.length) return;
    const next = [...etapas];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  function add() {
    onChange([
      ...etapas,
      { nome: "", duracao_min: 5, ordem: etapas.length },
    ]);
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Etapas de preparo</p>
          <p className="text-[11px] text-muted-foreground">
            Total: {totalMin} min · Gargalo: {gargalo} min (usado no pipeline
            quando há vários itens desta categoria)
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={add} type="button">
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {etapas.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Sem etapas. Sem etapas, esta categoria conta como 0 min no motor de
          estimativa.
        </p>
      )}

      <div className="space-y-2">
        {etapas.map((e, i) => (
          <div
            key={i}
            className="flex items-end gap-2 rounded-lg border border-border/60 bg-card p-2"
          >
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Subir"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Descer"
                disabled={i === etapas.length - 1}
                onClick={() => move(i, 1)}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-[11px]">Nome</Label>
              <Input
                value={e.nome}
                onChange={(ev) => update(i, { nome: ev.target.value })}
                placeholder="Ex: montagem"
                className="h-9"
              />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-[11px]">Min</Label>
              <Input
                type="number"
                min={0}
                value={e.duracao_min}
                onChange={(ev) =>
                  update(i, { duracao_min: Number(ev.target.value) || 0 })
                }
                className="h-9"
              />
            </div>
            <button
              type="button"
              aria-label="Remover"
              onClick={() => remove(i)}
              className="flex h-9 w-9 items-center justify-center rounded text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
