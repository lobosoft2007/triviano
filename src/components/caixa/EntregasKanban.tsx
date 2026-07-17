import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, Loader2, MapPin, Phone, Package, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  listEntregasKanban,
  listEntregadores,
  atribuirEntregador,
  marcarEmRota,
  marcarEntregue,
  type Entrega,
  type EntregaStatus,
} from "@/lib/entregas";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLUMNS: { key: EntregaStatus; label: string; hint: string }[] = [
  { key: "PENDENTE", label: "Pronto p/ sair", hint: "Aguardando atribuir entregador" },
  { key: "ATRIBUIDA", label: "Atribuída", hint: "Com entregador, aguardando saída" },
  { key: "EM_ROTA", label: "Em rota", hint: "Entregador a caminho" },
  { key: "ENTREGUE", label: "Entregue", hint: "Últimas concluídas" },
];

type CanalFiltro = "todos" | "PROPRIA" | "IFOOD";

export function EntregasKanban() {
  const queryClient = useQueryClient();
  const [canalFiltro, setCanalFiltro] = useState<CanalFiltro>("todos");

  const { data: entregas, isLoading } = useQuery({
    queryKey: ["entregas-kanban"],
    queryFn: listEntregasKanban,
    refetchInterval: 15_000,
  });

  const { data: entregadores } = useQuery({
    queryKey: ["entregadores"],
    queryFn: listEntregadores,
  });

  const entregadoresAtivos = useMemo(
    () => (entregadores ?? []).filter((e) => e.ativo),
    [entregadores],
  );

  const filtered = useMemo(
    () =>
      (entregas ?? []).filter(
        (e) => canalFiltro === "todos" || e.canal === canalFiltro,
      ),
    [entregas, canalFiltro],
  );

  async function handleAtribuir(entrega: Entrega, entregadorId: string) {
    try {
      await atribuirEntregador(entrega.id, entregadorId);
      await queryClient.invalidateQueries({ queryKey: ["entregas-kanban"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atribuir.");
    }
  }

  async function handleEmRota(entrega: Entrega) {
    if (!entrega.entregador_id) {
      toast.error("Atribua um entregador antes.");
      return;
    }
    try {
      await marcarEmRota(entrega.id, entrega.entregador_id);
      await queryClient.invalidateQueries({ queryKey: ["entregas-kanban"] });
      toast.success("Marcado como em rota.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro.");
    }
  }

  async function handleEntregue(entrega: Entrega) {
    try {
      await marcarEntregue(entrega.id);
      await queryClient.invalidateQueries({ queryKey: ["entregas-kanban"] });
      toast.success("Entrega concluída.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro.");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Painel de Entregas</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={canalFiltro}
            onValueChange={(v) => setCanalFiltro(v as CanalFiltro)}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="PROPRIA">Próprias</SelectItem>
              <SelectItem value="IFOOD">iFood</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid flex-1 gap-3 overflow-hidden lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const cards = filtered.filter((e) => e.status === col.key);
            return (
              <div
                key={col.key}
                className="flex min-h-0 flex-col rounded-2xl border border-border bg-secondary/30 p-2"
              >
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <div>
                    <h3 className="text-sm font-bold">{col.label}</h3>
                    <p className="text-[11px] text-muted-foreground">{col.hint}</p>
                  </div>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {cards.length === 0 ? (
                    <p className="rounded-lg bg-background/40 p-3 text-center text-[11px] text-muted-foreground">
                      Vazio
                    </p>
                  ) : (
                    cards.map((e) => (
                      <EntregaCard
                        key={e.id}
                        entrega={e}
                        entregadores={entregadoresAtivos}
                        onAtribuir={handleAtribuir}
                        onEmRota={handleEmRota}
                        onEntregue={handleEntregue}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EntregaCard({
  entrega,
  entregadores,
  onAtribuir,
  onEmRota,
  onEntregue,
}: {
  entrega: Entrega;
  entregadores: { id: string; nome: string }[];
  onAtribuir: (e: Entrega, id: string) => void;
  onEmRota: (e: Entrega) => void;
  onEntregue: (e: Entrega) => void;
}) {
  const isIfood = entrega.canal === "IFOOD";
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{entrega.pedido_cliente}</p>
          <p className="text-[11px] text-muted-foreground">
            #{entrega.order_id.slice(0, 8)} · {formatBRL(entrega.pedido_total)}
          </p>
        </div>
        {isIfood && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
            iFood
          </span>
        )}
      </div>

      {entrega.pedido_endereco && (
        <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{entrega.pedido_endereco}</span>
        </p>
      )}
      {entrega.pedido_telefone && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Phone className="h-3 w-3" />
          {entrega.pedido_telefone}
        </p>
      )}

      {entrega.status === "PENDENTE" && (
        <Select
          onValueChange={(v) => onAtribuir(entrega, v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Atribuir entregador" />
          </SelectTrigger>
          <SelectContent>
            {entregadores.length === 0 ? (
              <SelectItem value="__none__" disabled>
                Nenhum entregador ativo
              </SelectItem>
            ) : (
              entregadores.map((ent) => (
                <SelectItem key={ent.id} value={ent.id}>
                  {ent.nome}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {entrega.status === "ATRIBUIDA" && (
        <>
          <p className="text-[11px] font-medium text-primary">
            <Bike className="mr-1 inline h-3 w-3" />
            {entrega.entregador_nome ?? "—"}
          </p>
          <Button
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => onEmRota(entrega)}
          >
            <Package className="mr-1 h-3.5 w-3.5" /> Saiu para entrega
          </Button>
        </>
      )}

      {entrega.status === "EM_ROTA" && (
        <>
          <p className="text-[11px] font-medium text-primary">
            <Bike className="mr-1 inline h-3 w-3" />
            {entrega.entregador_nome ?? "—"}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-full text-xs"
            onClick={() => onEntregue(entrega)}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Marcar entregue
          </Button>
        </>
      )}

      {entrega.status === "ENTREGUE" && entrega.entregue_em && (
        <p className="text-[11px] text-muted-foreground">
          <CheckCircle2 className="mr-1 inline h-3 w-3 text-success" />
          {new Date(entrega.entregue_em).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {entrega.entregador_nome ?? "—"}
        </p>
      )}
    </div>
  );
}
