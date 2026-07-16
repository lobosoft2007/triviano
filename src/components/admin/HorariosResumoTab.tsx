import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { listAdminCategories, type AdminCategory } from "@/lib/erp";
import { DIAS_SEMANA } from "@/lib/horarios";
import { CategoriaHorariosDialog } from "@/components/admin/CategoriaHorariosDialog";

interface HorarioRow {
  categoria_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

type FilterMode = "all" | "open" | "closed";

const QK_CATS = ["admin-categories"];
const QK_HORARIOS = ["admin-horarios-resumo"];

function hhmm(s: string): string {
  return String(s).slice(0, 5);
}

/** Retorna true se `now` cai em [start, end], suportando janela que cruza meia-noite. */
function isNowInWindow(
  now: Date,
  dia: number,
  hStart: string,
  hEnd: string,
): boolean {
  const cur = now.getDay(); // 0..6
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = hStart.split(":").map(Number);
  const [eh, em] = hEnd.split(":").map(Number);
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;

  if (endM > startM) {
    // Janela dentro do mesmo dia
    return cur === dia && mins >= startM && mins < endM;
  }
  // Cruza meia-noite: parte 1 (dia atual, start..24h), parte 2 (dia seguinte, 0..end)
  if (cur === dia && mins >= startM) return true;
  const prev = (dia + 1) % 7;
  if (cur === prev && mins < endM) return true;
  return false;
}

export function HorariosResumoTab() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [editing, setEditing] = useState<AdminCategory | null>(null);

  // Tick a cada 60s para recalcular "aberta agora".
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const catsQ = useQuery({
    queryKey: QK_CATS,
    queryFn: listAdminCategories,
  });

  const horariosQ = useQuery({
    queryKey: QK_HORARIOS,
    queryFn: async (): Promise<HorarioRow[]> => {
      const { data, error } = await supabase
        .from("category_horarios" as never)
        .select("categoria_id, dia_semana, hora_inicio, hora_fim");
      if (error) throw error;
      return ((data ?? []) as unknown as HorarioRow[]).map((r) => ({
        categoria_id: r.categoria_id,
        dia_semana: Number(r.dia_semana),
        hora_inicio: hhmm(r.hora_inicio),
        hora_fim: hhmm(r.hora_fim),
      }));
    },
  });

  const byCat = useMemo(() => {
    const map = new Map<string, HorarioRow[]>();
    for (const r of horariosQ.data ?? []) {
      const arr = map.get(r.categoria_id) ?? [];
      arr.push(r);
      map.set(r.categoria_id, arr);
    }
    // Ordena por dia/hora
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          a.dia_semana - b.dia_semana ||
          a.hora_inicio.localeCompare(b.hora_inicio),
      );
    }
    return map;
  }, [horariosQ.data]);

  const statusOf = (
    catId: string,
  ): "open" | "closed" | "always" => {
    const arr = byCat.get(catId) ?? [];
    if (arr.length === 0) return "always";
    for (const w of arr) {
      if (isNowInWindow(now, w.dia_semana, w.hora_inicio, w.hora_fim)) {
        return "open";
      }
    }
    return "closed";
  };

  const cats = catsQ.data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cats
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .filter((c) => {
        if (filter === "all") return true;
        const st = statusOf(c.id);
        if (filter === "open") return st === "open" || st === "always";
        return st === "closed";
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, byCat, query, filter, now]);

  const totals = useMemo(() => {
    let open = 0,
      closed = 0,
      always = 0;
    for (const c of cats) {
      const s = statusOf(c.id);
      if (s === "open") open++;
      else if (s === "closed") closed++;
      else always++;
    }
    return { open, closed, always, total: cats.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, byCat, now]);

  const loading = catsQ.isLoading || horariosQ.isLoading;

  return (
    <div className="space-y-4">
      {/* Cabeçalho de status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Categorias" value={totals.total} />
        <StatCard
          label="Abertas agora"
          value={totals.open}
          tone="success"
        />
        <StatCard
          label="Sempre disponíveis"
          value={totals.always}
          tone="warning"
        />
        <StatCard
          label="Fechadas agora"
          value={totals.closed}
          tone="muted"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoria..."
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            Todas
          </Button>
          <Button
            size="sm"
            variant={filter === "open" ? "default" : "outline"}
            onClick={() => setFilter("open")}
          >
            Abertas
          </Button>
          <Button
            size="sm"
            variant={filter === "closed" ? "default" : "outline"}
            onClick={() => setFilter("closed")}
          >
            Fechadas
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando
          horários...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Nenhuma categoria encontrada.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const st = statusOf(c.id);
            const janelas = byCat.get(c.id) ?? [];
            return (
              <div
                key={c.id}
                className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.product_count} produto
                      {c.product_count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <StatusBadge status={st} />
                </div>

                {/* Mini-grade Dom–Sáb */}
                <div className="grid grid-cols-7 gap-1 text-[10px]">
                  {DIAS_SEMANA.map((d) => {
                    const dayWindows = janelas.filter(
                      (j) => j.dia_semana === d.value,
                    );
                    const isToday = now.getDay() === d.value;
                    return (
                      <div
                        key={d.value}
                        className={`rounded border p-1 text-center ${
                          isToday
                            ? "border-primary/60 bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <div className="font-semibold text-muted-foreground">
                          {d.short}
                        </div>
                        {dayWindows.length === 0 ? (
                          <div className="text-muted-foreground/60">—</div>
                        ) : (
                          <div className="space-y-0.5 mt-0.5">
                            {dayWindows.map((w, i) => (
                              <div key={i} className="leading-tight">
                                {w.hora_inicio}
                                <br />
                                {w.hora_fim}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setEditing(c)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Editar horários
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <CategoriaHorariosDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          categoriaId={editing.id}
          categoriaNome={editing.name}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: QK_HORARIOS });
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "open" | "closed" | "always" }) {
  if (status === "open") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">
        Aberta agora
      </Badge>
    );
  }
  if (status === "always") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/15">
        Sempre disponível
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Fechada agora
    </Badge>
  );
}
