import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, Armchair, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  listMesasFisicas,
  upsertMesaFisica,
  deleteMesaFisica,
  listSlots,
  upsertSlot,
  fetchReservaConfig,
  updateReservaConfig,
  type ReservaConfig,
} from "@/lib/reservas";
import { empresaQueryOptions } from "@/lib/empresa";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Grid de horários (30 min) exibida no editor de slots. */
function buildHoras(): string[] {
  const out: string[] = [];
  for (let h = 10; h <= 23; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}
const HORAS = buildHoras();

export function ReservasConfigTab() {
  const qc = useQueryClient();
  const { data: empresa } = useQuery(empresaQueryOptions);
  const empresaId = empresa?.id ?? "";

  const { data: config, isLoading: cfgLoading } = useQuery({
    queryKey: ["reserva-config", empresaId],
    queryFn: () => fetchReservaConfig(empresaId),
    enabled: !!empresaId,
  });

  const { data: mesas, isLoading: mesasLoading } = useQuery({
    queryKey: ["mesas-fisicas"],
    queryFn: listMesasFisicas,
  });

  const { data: slots } = useQuery({
    queryKey: ["reserva-slots"],
    queryFn: listSlots,
  });

  const [form, setForm] = useState<ReservaConfig | null>(null);
  const [savingCfg, setSavingCfg] = useState(false);
  const [novaMesa, setNovaMesa] = useState({ numero: "", capacidade: "4", zona: "" });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const saveConfig = async () => {
    if (!form || !empresaId) return;
    setSavingCfg(true);
    try {
      await updateReservaConfig(empresaId, form);
      toast.success("Configuração salva.");
      qc.invalidateQueries({ queryKey: ["reserva-config"] });
      qc.invalidateQueries({ queryKey: ["empresa"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSavingCfg(false);
    }
  };

  const addMesa = async () => {
    const numero = Number(novaMesa.numero);
    const capacidade = Number(novaMesa.capacidade);
    if (!numero || !capacidade) {
      toast.error("Informe número e capacidade.");
      return;
    }
    try {
      await upsertMesaFisica({
        numero,
        capacidade,
        zona: novaMesa.zona,
        ativa: true,
      });
      setNovaMesa({ numero: "", capacidade: "4", zona: "" });
      qc.invalidateQueries({ queryKey: ["mesas-fisicas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar mesa.");
    }
  };

  const removeMesa = async (id: string) => {
    if (!confirm("Remover esta mesa física?")) return;
    try {
      await deleteMesaFisica(id);
      qc.invalidateQueries({ queryKey: ["mesas-fisicas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover.");
    }
  };

  const slotValue = (dia: number, hora: string): number => {
    const s = slots?.find((x) => x.dia_semana === dia && x.hora.startsWith(hora));
    return s?.assentos ?? 0;
  };

  const changeSlot = async (dia: number, hora: string, valor: number) => {
    try {
      await upsertSlot(dia, `${hora}:00`, Math.max(0, valor | 0));
      qc.invalidateQueries({ queryKey: ["reserva-slots"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar slot.");
    }
  };

  if (cfgLoading || !form) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------------- Regras gerais ---------------- */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold">Reservas & Pedido na Mesa</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <div>
              <p className="text-sm font-semibold">Aceitar reservas online</p>
              <p className="text-xs text-muted-foreground">Habilita o fluxo de reservas no PWA do cliente.</p>
            </div>
            <Switch
              checked={form.reserva_ativa}
              onCheckedChange={(v) => setForm({ ...form, reserva_ativa: v })}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <div>
              <p className="text-sm font-semibold">Cliente pede pela mesa (PWA)</p>
              <p className="text-xs text-muted-foreground">Se desligado, apenas o garçom pode lançar itens.</p>
            </div>
            <Switch
              checked={form.pedido_na_mesa_pelo_cliente}
              onCheckedChange={(v) => setForm({ ...form, pedido_na_mesa_pelo_cliente: v })}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Duração da reserva (min)</Label>
            <Input
              type="number"
              value={form.reserva_duracao_min}
              onChange={(e) => setForm({ ...form, reserva_duracao_min: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label>Antecedência mínima (horas)</Label>
            <Input
              type="number"
              value={form.reserva_antecedencia_min_horas}
              onChange={(e) =>
                setForm({ ...form, reserva_antecedencia_min_horas: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Antecedência máxima (dias)</Label>
            <Input
              type="number"
              value={form.reserva_antecedencia_max_dias}
              onChange={(e) =>
                setForm({ ...form, reserva_antecedencia_max_dias: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Tolerância (min)</Label>
            <Input
              type="number"
              value={form.reserva_tolerancia_min}
              onChange={(e) => setForm({ ...form, reserva_tolerancia_min: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label>Grupo mínimo</Label>
            <Input
              type="number"
              value={form.reserva_grupo_min}
              onChange={(e) => setForm({ ...form, reserva_grupo_min: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-1">
            <Label>Grupo máximo</Label>
            <Input
              type="number"
              value={form.reserva_grupo_max}
              onChange={(e) => setForm({ ...form, reserva_grupo_max: Number(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <div>
              <p className="text-sm font-semibold">Cobrar sinal (Mercado Pago)</p>
              <p className="text-xs text-muted-foreground">Reserva só é confirmada após o pagamento.</p>
            </div>
            <Switch
              checked={form.reserva_sinal_ativo}
              onCheckedChange={(v) => setForm({ ...form, reserva_sinal_ativo: v })}
            />
          </label>
          <div className="space-y-1">
            <Label>Sinal por pessoa (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.reserva_sinal_por_pessoa}
              onChange={(e) =>
                setForm({ ...form, reserva_sinal_por_pessoa: Number(e.target.value) || 0 })
              }
              disabled={!form.reserva_sinal_ativo}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={saveConfig} disabled={savingCfg}>
            {savingCfg ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Salvar configuração
          </Button>
        </div>
      </section>

      {/* ---------------- Slots (matriz semanal) ---------------- */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold">Capacidade por horário</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Informe quantos assentos aceitam reserva em cada slot de 30 min. Deixe 0 para bloquear
          o horário. Os valores são salvos automaticamente.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card p-1 text-left font-semibold">Hora</th>
                {DIAS.map((d, i) => (
                  <th key={i} className="p-1 font-semibold">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HORAS.map((hora) => (
                <tr key={hora} className="border-t border-border/50">
                  <td className="sticky left-0 bg-card p-1 font-mono">{hora}</td>
                  {DIAS.map((_, dia) => (
                    <td key={dia} className="p-1">
                      <Input
                        type="number"
                        min={0}
                        defaultValue={slotValue(dia, hora)}
                        onBlur={(e) => {
                          const v = Number(e.target.value) || 0;
                          if (v !== slotValue(dia, hora)) changeSlot(dia, hora, v);
                        }}
                        className="h-8 w-16 text-center"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- Mesas físicas ---------------- */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Armchair className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold">Mesas físicas do salão</h2>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-[100px_140px_1fr_auto]">
          <Input
            type="number"
            placeholder="Nº"
            value={novaMesa.numero}
            onChange={(e) => setNovaMesa({ ...novaMesa, numero: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Lugares"
            value={novaMesa.capacidade}
            onChange={(e) => setNovaMesa({ ...novaMesa, capacidade: e.target.value })}
          />
          <Input
            placeholder="Zona (opcional)"
            value={novaMesa.zona}
            onChange={(e) => setNovaMesa({ ...novaMesa, zona: e.target.value })}
          />
          <Button onClick={addMesa}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>

        {mesasLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (mesas ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma mesa cadastrada.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(mesas ?? []).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                  {m.numero}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    Mesa {m.numero} · {m.capacidade} lugares
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.zona || "sem zona definida"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeMesa(m.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
