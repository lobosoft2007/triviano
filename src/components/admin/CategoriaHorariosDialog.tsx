import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DIAS_SEMANA,
  listCategoryHorarios,
  saveCategoryHorarios,
  type Horario,
} from "@/lib/horarios";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoriaId: string;
  categoriaNome: string;
  onSaved?: () => void;
}

interface DiaState {
  ativo: boolean;
  janelas: { hora_inicio: string; hora_fim: string }[];
}

const EMPTY_JANELA = { hora_inicio: "08:00", hora_fim: "18:00" };

function initialByDay(rows: Horario[]): Record<number, DiaState> {
  const map: Record<number, DiaState> = {};
  for (const d of DIAS_SEMANA) {
    map[d.value] = { ativo: false, janelas: [] };
  }
  for (const r of rows) {
    const s = map[r.dia_semana];
    s.ativo = true;
    s.janelas.push({ hora_inicio: r.hora_inicio, hora_fim: r.hora_fim });
  }
  return map;
}

export function CategoriaHorariosDialog({
  open,
  onOpenChange,
  categoriaId,
  categoriaNome,
  onSaved,
}: Props) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["categoria-horarios", categoriaId],
    queryFn: () => listCategoryHorarios(categoriaId),
    enabled: open,
  });

  const [state, setState] = useState<Record<number, DiaState>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setState(initialByDay(data));
  }, [data]);

  const toggleDia = (dia: number, on: boolean) => {
    setState((prev) => ({
      ...prev,
      [dia]: {
        ativo: on,
        janelas: on
          ? prev[dia].janelas.length > 0
            ? prev[dia].janelas
            : [{ ...EMPTY_JANELA }]
          : [],
      },
    }));
  };

  const addJanela = (dia: number) => {
    setState((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], janelas: [...prev[dia].janelas, { ...EMPTY_JANELA }] },
    }));
  };

  const removeJanela = (dia: number, idx: number) => {
    setState((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        janelas: prev[dia].janelas.filter((_, i) => i !== idx),
      },
    }));
  };

  const setJanela = (
    dia: number,
    idx: number,
    field: "hora_inicio" | "hora_fim",
    value: string,
  ) => {
    setState((prev) => {
      const copy = prev[dia].janelas.map((j, i) =>
        i === idx ? { ...j, [field]: value } : j,
      );
      return { ...prev, [dia]: { ...prev[dia], janelas: copy } };
    });
  };

  const copyToAll = (dia: number) => {
    const source = state[dia];
    if (!source || source.janelas.length === 0) {
      toast.error("Adicione ao menos uma janela neste dia primeiro.");
      return;
    }
    setState((prev) => {
      const next: Record<number, DiaState> = { ...prev };
      for (const d of DIAS_SEMANA) {
        if (d.value === dia) continue;
        next[d.value] = {
          ativo: true,
          janelas: source.janelas.map((j) => ({ ...j })),
        };
      }
      return next;
    });
    toast.success("Horários copiados para os demais dias.");
  };

  const handleSave = async () => {
    // Validação: fim > início.
    const flat: Horario[] = [];
    for (const d of DIAS_SEMANA) {
      const s = state[d.value];
      if (!s?.ativo) continue;
      for (const j of s.janelas) {
        if (!j.hora_inicio || !j.hora_fim || j.hora_fim <= j.hora_inicio) {
          toast.error(
            `Horário inválido em ${d.label}: o fim deve ser maior que o início.`,
          );
          return;
        }
        flat.push({
          dia_semana: d.value,
          hora_inicio: j.hora_inicio,
          hora_fim: j.hora_fim,
        });
      }
    }
    setSaving(true);
    try {
      await saveCategoryHorarios(categoriaId, flat);
      toast.success(
        flat.length === 0
          ? "Sem restrição — categoria disponível 24/7."
          : "Horários salvos!",
      );
      await refetch();
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar horários.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="flex max-h-[90vh] max-w-lg flex-col p-0">
        <div className="shrink-0 border-b border-border bg-background px-6 pt-6 pb-3">
          <ModalActionBar
            title={`Horários — ${categoriaNome}`}
            onBack={() => onOpenChange(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Salvar"
          />

          <p className="mt-2 text-xs text-muted-foreground">
            <Clock className="mr-1 inline h-3 w-3" />
            Sem nenhuma janela = categoria disponível o tempo todo. Múltiplas
            janelas por dia são permitidas (ex.: 11:00–15:00 e 18:00–23:00).
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {DIAS_SEMANA.map((d) => {
              const s = state[d.value] ?? { ativo: false, janelas: [] };
              return (
                <div
                  key={d.value}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.ativo}
                        onCheckedChange={(v) => toggleDia(d.value, v)}
                      />
                      <span className="font-semibold">{d.label}</span>
                    </div>
                    {s.ativo && (
                      <button
                        type="button"
                        onClick={() => copyToAll(d.value)}
                        className="text-xs text-primary underline"
                      >
                        Copiar p/ outros dias
                      </button>
                    )}
                  </div>

                  {s.ativo && (
                    <div className="mt-3 space-y-2">
                      {s.janelas.map((j, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={j.hora_inicio}
                            onChange={(e) =>
                              setJanela(d.value, idx, "hora_inicio", e.target.value)
                            }
                            className="w-32"
                          />
                          <span className="text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={j.hora_fim}
                            onChange={(e) =>
                              setJanela(d.value, idx, "hora_fim", e.target.value)
                            }
                            className="w-32"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeJanela(d.value, idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addJanela(d.value)}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar janela
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
