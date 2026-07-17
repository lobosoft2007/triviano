import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  Power,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import {
  listIfoodMerchants,
  saveIfoodMerchant,
  deleteIfoodMerchant,
  togglePolling,
  setStoreStatus,
  type IfoodMerchant,
  type IfoodStatusLoja,
} from "@/lib/ifood";
import { empresaAdminConfigQueryOptions } from "@/lib/empresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconBtn } from "./SetoresCrud";
import { Field } from "./FornecedoresCrud";

interface FormState {
  id: string | null;
  merchant_id: string;
  nome: string;
  client_id: string;
  client_secret: string;
  polling_enabled: boolean;
  status_loja: IfoodStatusLoja;
}

const EMPTY: FormState = {
  id: null,
  merchant_id: "",
  nome: "",
  client_id: "",
  client_secret: "",
  polling_enabled: false,
  status_loja: "CLOSED",
};

export function IfoodMerchantsCrud() {
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery(empresaAdminConfigQueryOptions);
  const { data, isLoading } = useQuery({
    queryKey: ["ifood-merchants"],
    queryFn: listIfoodMerchants,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (m: IfoodMerchant) => {
    setForm({
      id: m.id,
      merchant_id: m.merchant_id,
      nome: m.nome,
      client_id: m.client_id,
      client_secret: m.client_secret,
      polling_enabled: m.polling_enabled,
      status_loja: m.status_loja,
    });
    setOpen(true);
  };

  async function handleSave() {
    if (!empresa) return;
    if (!form.nome.trim() || !form.merchant_id.trim()) {
      toast.error("Informe o nome e o Merchant ID.");
      return;
    }
    setSaving(true);
    try {
      await saveIfoodMerchant({
        id: form.id,
        empresa_id: empresa.id,
        merchant_id: form.merchant_id,
        nome: form.nome,
        client_id: form.client_id,
        client_secret: form.client_secret,
        polling_enabled: form.polling_enabled,
        status_loja: form.status_loja,
      });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["ifood-merchants"] });
      toast.success("Loja iFood salva!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: IfoodMerchant) {
    if (!confirm(`Remover a loja "${m.nome}"?`)) return;
    try {
      await deleteIfoodMerchant(m.id);
      await queryClient.invalidateQueries({ queryKey: ["ifood-merchants"] });
      toast.success("Loja removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  async function handleTogglePolling(m: IfoodMerchant, enabled: boolean) {
    try {
      await togglePolling(m.id, enabled);
      await queryClient.invalidateQueries({ queryKey: ["ifood-merchants"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar.");
    }
  }

  async function handleStatusLoja(m: IfoodMerchant, status: IfoodStatusLoja) {
    try {
      await setStoreStatus(m.id, status);
      await queryClient.invalidateQueries({ queryKey: ["ifood-merchants"] });
      toast.success(status === "OPEN" ? "Loja aberta." : "Loja fechada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar status.");
    }
  }

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold">iFood — Lojas</h2>
            <p className="text-xs text-muted-foreground">
              Credenciais e sincronização de pedidos por loja iFood.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova loja
        </Button>
      </header>

      <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
        <strong>Setup:</strong> cadastre a loja e cole o <em>merchant_id</em>,
        <em> client_id</em> e <em>client_secret</em> obtidos no Portal do Parceiro
        iFood. A sincronização automática (polling) começa quando você ligar o
        switch — a rotina de recebimento de pedidos será conectada na próxima
        etapa (Fase 1.5).
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhuma loja iFood conectada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Loja</th>
                <th className="px-4 py-2.5 font-semibold">Merchant ID</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Polling</th>
                <th className="px-4 py-2.5 font-semibold">Sincronizado</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data!.map((m, idx) => (
                <tr key={m.id} className={idx > 0 ? "border-t border-border" : ""}>
                  <td className="px-4 py-2.5 font-medium">{m.nome}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {m.merchant_id}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          m.status_loja === "OPEN"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {m.status_loja === "OPEN"
                          ? "Aberta"
                          : m.status_loja === "PAUSED"
                            ? "Pausada"
                            : "Fechada"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleStatusLoja(
                            m,
                            m.status_loja === "OPEN" ? "CLOSED" : "OPEN",
                          )
                        }
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title={m.status_loja === "OPEN" ? "Fechar loja" : "Abrir loja"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Switch
                      checked={m.polling_enabled}
                      onCheckedChange={(v) => handleTogglePolling(m, v)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {m.ultima_sincronizacao
                      ? new Date(m.ultima_sincronizacao).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <IconBtn label="Editar" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        label="Remover"
                        destructive
                        onClick={() => handleDelete(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <ModalActionBar
            title={form.id ? "Editar loja iFood" : "Nova loja iFood"}
            onBack={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Salvar"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome (rótulo interno)" className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Loja Matriz — Clube 23"
              />
            </Field>
            <Field label="Merchant ID (iFood)" className="sm:col-span-2">
              <Input
                value={form.merchant_id}
                onChange={(e) => setForm({ ...form, merchant_id: e.target.value })}
                placeholder="UUID da loja no iFood"
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Client ID">
              <Input
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                placeholder="OAuth client_id"
              />
            </Field>
            <Field label="Client Secret">
              <Input
                type="password"
                value={form.client_secret}
                onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                placeholder="OAuth client_secret"
              />
            </Field>
            <Field label="Status inicial da loja">
              <Select
                value={form.status_loja}
                onValueChange={(v) =>
                  setForm({ ...form, status_loja: v as IfoodStatusLoja })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLOSED">Fechada</SelectItem>
                  <SelectItem value="OPEN">Aberta</SelectItem>
                  <SelectItem value="PAUSED">Pausada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <Label className="cursor-pointer">Polling habilitado</Label>
              </div>
              <Switch
                checked={form.polling_enabled}
                onCheckedChange={(v) => setForm({ ...form, polling_enabled: v })}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
