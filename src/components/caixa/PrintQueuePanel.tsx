import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Printer as PrinterIcon } from "lucide-react";

interface PrintJobRow {
  id: string;
  status: "pending" | "printing" | "done" | "failed" | "expired";
  tipo: string;
  attempts: number;
  printer_id: string | null;
  last_error: string | null;
  created_at: string;
  next_attempt_at: string | null;
  printed_at: string | null;
}

interface PrinterRef {
  id: string;
  nome: string;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Na fila", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  printing: { label: "Imprimindo", className: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  done: { label: "Impresso", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  failed: { label: "Falhou", className: "bg-red-500/15 text-red-700 border-red-500/30" },
  expired: { label: "Expirado", className: "bg-muted text-muted-foreground border-border" },
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function PrintQueuePanel() {
  const qc = useQueryClient();

  const jobsQuery = useQuery<PrintJobRow[]>({
    queryKey: ["print-jobs-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_jobs")
        .select(
          "id, status, tipo, attempts, printer_id, last_error, created_at, next_attempt_at, printed_at",
        )
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as PrintJobRow[];
    },
    refetchInterval: 5000,
  });

  const printersQuery = useQuery<PrinterRef[]>({
    queryKey: ["print-jobs-panel-printers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_impressoras")
        .select("id, nome");
      if (error) throw error;
      return (data ?? []) as PrinterRef[];
    },
    staleTime: 60_000,
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.rpc("retry_print_job", { p_job_id: jobId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job reenfileirado");
      qc.invalidateQueries({ queryKey: ["print-jobs-panel"] });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao reenfileirar"),
  });

  const printerName = (id: string | null) => {
    if (!id) return "—";
    return printersQuery.data?.find((p) => p.id === id)?.nome ?? "?";
  };

  const jobs = jobsQuery.data ?? [];
  const atrasados = jobs.filter(
    (j) => j.status === "pending" && new Date(j.created_at).getTime() < Date.now() - 30_000,
  ).length;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PrinterIcon className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm">Fila de impressão</h4>
          {atrasados > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {atrasados} atrasado{atrasados > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => jobsQuery.refetch()}
          className="h-7"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Atualizar
        </Button>
      </div>

      {jobs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Sem jobs recentes.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-auto">
          {jobs.map((j) => {
            const s = STATUS_LABEL[j.status] ?? STATUS_LABEL.pending;
            return (
              <div
                key={j.id}
                className="flex items-center gap-2 text-xs bg-background/50 rounded-lg px-2 py-1.5 border border-border/50"
              >
                <Badge variant="outline" className={s.className}>
                  {s.label}
                </Badge>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {j.tipo}
                </span>
                <span className="flex-1 truncate">{printerName(j.printer_id)}</span>
                <span className="text-muted-foreground">
                  {j.attempts > 0 ? `${j.attempts}x` : ""}
                </span>
                <span className="text-muted-foreground hidden sm:inline">
                  {fmtTime(j.created_at)}
                </span>
                {(j.status === "failed" || j.status === "expired") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => retryMutation.mutate(j.id)}
                    disabled={retryMutation.isPending}
                  >
                    Reimprimir
                  </Button>
                )}
                {j.last_error && (
                  <span
                    className="text-red-600 truncate max-w-[180px]"
                    title={j.last_error}
                  >
                    {j.last_error}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
