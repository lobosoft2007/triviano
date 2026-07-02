import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, Ban, ShieldCheck, User } from "lucide-react";
import {
  fetchClientes,
  setClienteBloqueado,
  type Cliente,
} from "@/lib/clientes";
import { composeAddress } from "@/lib/profile";
import { formatBRL } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Read-only customer directory shared by /caixa and /admin.
 * Displays every profile field except the password (which is never exposed).
 * `canBlock` enables the admin-only block/unblock action.
 */
export function ClientesView({ canBlock = false }: { canBlock?: boolean }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Cliente | null>(null);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: fetchClientes,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clientes ?? [];
    if (!q) return list;
    return list.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.telefone.includes(q) ||
        c.municipio.toLowerCase().includes(q) ||
        c.bairro.toLowerCase().includes(q),
    );
  }, [clientes, search]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone, bairro ou cidade…"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado.
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-card transition-colors hover:bg-secondary/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {c.full_name || "Cliente sem nome"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.phone || "sem telefone"}
                  {c.municipio ? ` · ${c.municipio}` : ""}
                </p>
              </div>
              {c.bloqueado && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                  Bloqueado
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ClienteDetailDialog
          cliente={selected}
          open={!!selected}
          onOpenChange={(v) => {
            if (!v) setSelected(null);
          }}
          canBlock={canBlock}
          onUpdated={(next) => setSelected(next)}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

function ClienteDetailDialog({
  cliente,
  open,
  onOpenChange,
  canBlock,
  onUpdated,
}: {
  cliente: Cliente;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canBlock: boolean;
  onUpdated: (c: Cliente) => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function toggleBlock() {
    const next = !cliente.bloqueado;
    if (
      !confirm(
        next
          ? `Bloquear "${cliente.full_name || "cliente"}"? Ele não poderá fazer novos pedidos.`
          : `Desbloquear "${cliente.full_name || "cliente"}"?`,
      )
    )
      return;
    setBusy(true);
    try {
      await setClienteBloqueado(cliente.id, next);
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(next ? "Cliente bloqueado." : "Cliente desbloqueado.");
      onUpdated({ ...cliente, bloqueado: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {cliente.full_name || "Cliente"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {cliente.bloqueado && (
            <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              Cliente bloqueado
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" value={cliente.full_name} />
            <Field label="Telefone" value={cliente.phone || cliente.telefone} />
            <Field label="CEP" value={cliente.cep} />
            <Field label="Cidade" value={cliente.municipio} />
            <Field label="Bairro" value={cliente.bairro} />
            <Field label="Estado" value={cliente.estado} />
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Endereço
            </p>
            <p className="text-sm">
              {composeAddress(cliente) || cliente.address || "—"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-secondary p-3">
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground">Fiado</span>
              <span className="text-sm font-semibold">
                {cliente.fiado_autorizado ? "Autorizado" : "Não"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground">Devedor</span>
              <span className="text-sm font-semibold tabular-nums text-destructive">
                {formatBRL(cliente.saldo_devedor_fiado)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground">Cashback</span>
              <span className="text-sm font-semibold tabular-nums text-primary">
                {formatBRL(cliente.saldo_cashback)}
              </span>
            </div>
          </div>

          {canBlock && (
            <Button
              variant={cliente.bloqueado ? "outline" : "destructive"}
              className="w-full rounded-xl"
              disabled={busy}
              onClick={toggleBlock}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : cliente.bloqueado ? (
                <ShieldCheck className="mr-2 h-4 w-4" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              {cliente.bloqueado ? "Desbloquear cliente" : "Bloquear cliente"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
