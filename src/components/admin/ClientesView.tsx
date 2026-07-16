import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Ban,
  ShieldCheck,
  User,
  Pencil,
  Save,
  X,
  UserPlus,
} from "lucide-react";
import {
  fetchClientes,
  setClienteBloqueado,
  adminUpdateCliente,
  type Cliente,
} from "@/lib/clientes";
import { createClienteByAdmin } from "@/lib/clientes-admin.functions";
import { composeAddress } from "@/lib/profile";
import { geocodeAddress } from "@/lib/cep";
import { formatBRL } from "@/lib/format";
import {
  AddressFields,
  emptyAddress,
  type AddressState,
} from "@/components/AddressFields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

/**
 * Read-only customer directory shared by /caixa and /admin.
 * Displays every profile field except the password (which is never exposed).
 * `canBlock` enables the admin-only block/unblock action.
 */
export function ClientesView({ canBlock = false }: { canBlock?: boolean }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [creating, setCreating] = useState(false);


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
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, bairro ou cidade…"
            className="h-11 rounded-xl pl-9"
          />
        </div>
        {canBlock && (
          <Button
            onClick={() => setCreating(true)}
            className="h-11 shrink-0 rounded-xl"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Novo cliente
          </Button>
        )}
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

      {creating && (
        <NewClienteDialog
          open={creating}
          onOpenChange={setCreating}
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
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(cliente.full_name);
  const [address, setAddress] = useState<AddressState>({
    cep: cliente.cep,
    tipo_logradouro: cliente.tipo_logradouro,
    logradouro: cliente.logradouro,
    numero: cliente.numero,
    complemento: cliente.complemento,
    bairro: cliente.bairro,
    municipio: cliente.municipio,
    estado: cliente.estado,
    ddd: cliente.ddd,
    telefone: cliente.telefone,
  });

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

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setBusy(true);
    try {
      // Background geocoding to keep lat/long in sync with the new address.
      const geo = await geocodeAddress({
        logradouro: address.logradouro,
        numero: address.numero,
        bairro: address.bairro,
        municipio: address.municipio,
        estado: address.estado,
        cep: address.cep,
      });
      await adminUpdateCliente(cliente.id, {
        full_name: fullName.trim(),
        ...address,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      await queryClient.invalidateQueries({ queryKey: ["fiado-clients"] });
      const phone = [address.ddd, address.telefone].filter(Boolean).join(" ").trim();
      const next: Cliente = {
        ...cliente,
        full_name: fullName.trim(),
        ...address,
        phone,
        address: composeAddress(address),
      };
      onUpdated(next);
      toast.success("Dados do cliente atualizados.");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-h-[90vh] max-w-md overflow-y-auto">
        <ModalActionBar
          title={cliente.full_name || "Cliente"}
          onBack={() => (editing ? setEditing(false) : onOpenChange(false))}
          onSave={editing ? handleSave : undefined}
          saving={busy}
          hideSave={!editing}
          saveLabel="Salvar"
        />

        {editing ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_full_name">Nome completo</Label>
              <Input
                id="edit_full_name"
                className="h-12 rounded-xl"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <AddressFields value={address} onChange={setAddress} />
          </div>
        ) : (
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
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="w-full rounded-xl"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Editar dados e endereço
                </Button>
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
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewClienteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createClienteByAdmin);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [sendReset, setSendReset] = useState(true);
  const [address, setAddress] = useState<AddressState>(emptyAddress);

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setBusy(true);
    try {
      const geo = await geocodeAddress({
        logradouro: address.logradouro,
        numero: address.numero,
        bairro: address.bairro,
        municipio: address.municipio,
        estado: address.estado,
        cep: address.cep,
      });
      await create({
        data: {
          email: email.trim(),
          full_name: fullName.trim(),
          ...address,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          send_reset: sendReset,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(
        sendReset
          ? "Cliente criado. Enviamos o link para definir a senha."
          : "Cliente criado. Ele poderá definir a senha em 'Esqueci minha senha'.",
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar cliente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-h-[90vh] max-w-md overflow-y-auto">
        <ModalActionBar
          title="Novo cliente"
          onBack={() => onOpenChange(false)}
          onSave={handleSave}
          saving={busy}
          saveLabel="Criar"
        />
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_full_name">Nome completo</Label>
            <Input
              id="new_full_name"
              className="h-12 rounded-xl"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_email">E-mail</Label>
            <Input
              id="new_email"
              type="email"
              autoComplete="off"
              placeholder="cliente@email.com"
              className="h-12 rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O cliente definirá a própria senha pelo link "Esqueci minha senha".
            </p>
          </div>
          <AddressFields value={address} onChange={setAddress} />
          <label className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
            <Checkbox
              checked={sendReset}
              onCheckedChange={(v) => setSendReset(v === true)}
            />
            <span>Enviar agora o e-mail para definir a senha</span>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

