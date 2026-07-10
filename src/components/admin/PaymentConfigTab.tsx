import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  listConfigPagamentos,
  saveConfigPagamento,
  deleteConfigPagamento,
  type ConfigPagamento,
} from "@/lib/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

const GATEWAYS = ["Efí", "Mercado Pago", "Inter", "Asaas", "Outro"];

interface FormState {
  id: string | null;
  gateway_banco: string;
  client_id: string;
  client_secret: string;
  chave_pix_padrao: string;
  nome_recebedor: string;
  cidade_recebedor: string;
  ativo: boolean;
  mp_access_token: string;
  mp_public_key: string;
  mp_webhook_secret: string;
  mp_ativo: boolean;
  mp_ambiente: string;
}

const EMPTY: FormState = {
  id: null,
  gateway_banco: GATEWAYS[0],
  client_id: "",
  client_secret: "",
  chave_pix_padrao: "",
  nome_recebedor: "",
  cidade_recebedor: "",
  ativo: true,
  mp_access_token: "",
  mp_public_key: "",
  mp_webhook_secret: "",
  mp_ativo: false,
  mp_ambiente: "test",
};

export function PaymentConfigTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config-pagamentos"],
    queryFn: listConfigPagamentos,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (c: ConfigPagamento) => {
    setForm({
      id: c.id,
      gateway_banco: c.gateway_banco || GATEWAYS[0],
      client_id: c.client_id,
      client_secret: c.client_secret,
      chave_pix_padrao: c.chave_pix_padrao,
      nome_recebedor: c.nome_recebedor,
      cidade_recebedor: c.cidade_recebedor,
      ativo: c.ativo,
      mp_access_token: c.mp_access_token,
      mp_public_key: c.mp_public_key,
      mp_webhook_secret: c.mp_webhook_secret,
      mp_ativo: c.mp_ativo,
      mp_ambiente: c.mp_ambiente || "test",
    });
    setOpen(true);
  };

  async function handleSave() {
    if (!form.chave_pix_padrao.trim() || !form.nome_recebedor.trim()) {
      toast.error("Informe ao menos a chave PIX e o nome do recebedor.");
      return;
    }
    setSaving(true);
    try {
      await saveConfigPagamento(form);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["config-pagamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["active-pix-config"] });
      toast.success("Configuração de pagamento salva!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: ConfigPagamento) {
    if (!confirm(`Remover a configuração "${c.gateway_banco}"?`)) return;
    try {
      await deleteConfigPagamento(c.id);
      await queryClient.invalidateQueries({ queryKey: ["config-pagamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["active-pix-config"] });
      toast.success("Configuração removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section className="w-full">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">
              Configurações de pagamento
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina o gateway e os dados PIX usados no checkout. A configuração
            marcada como ativa alimenta a chave, o nome e a cidade do QR Code.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhuma configuração cadastrada. O checkout usará os dados PIX padrão
          até que uma configuração ativa seja criada.
        </p>
      ) : (
        <div className="space-y-3">
          {data!.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.gateway_banco || "—"}</span>
                    {c.ativo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Ativa
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    Chave: {c.chave_pix_padrao || "—"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.nome_recebedor || "—"}
                    {c.cidade_recebedor ? ` • ${c.cidade_recebedor}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    aria-label="Editar"
                    onClick={() => openEdit(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Remover"
                    onClick={() => handleDelete(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-h-[90vh] max-w-lg overflow-y-auto">
          <ModalActionBar
            title={form.id ? "Editar configuração" : "Nova configuração de pagamento"}
            onBack={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Salvar"
          />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Gateway / banco</Label>
              <select
                value={form.gateway_banco}
                onChange={(e) =>
                  setForm({ ...form, gateway_banco: e.target.value })
                }
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                {GATEWAYS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cfg-client-id">Client ID</Label>
                <Input
                  id="cfg-client-id"
                  value={form.client_id}
                  onChange={(e) =>
                    setForm({ ...form, client_id: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfg-client-secret">Client Secret</Label>
                <Input
                  id="cfg-client-secret"
                  type="password"
                  value={form.client_secret}
                  onChange={(e) =>
                    setForm({ ...form, client_secret: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-chave">Chave PIX padrão</Label>
              <Input
                id="cfg-chave"
                value={form.chave_pix_padrao}
                onChange={(e) =>
                  setForm({ ...form, chave_pix_padrao: e.target.value })
                }
                placeholder="Telefone, e-mail, CPF/CNPJ ou aleatória"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cfg-nome">Nome do recebedor</Label>
                <Input
                  id="cfg-nome"
                  value={form.nome_recebedor}
                  onChange={(e) =>
                    setForm({ ...form, nome_recebedor: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfg-cidade">Cidade do recebedor</Label>
                <Input
                  id="cfg-cidade"
                  value={form.cidade_recebedor}
                  onChange={(e) =>
                    setForm({ ...form, cidade_recebedor: e.target.value })
                  }
                />
              </div>
            </div>

            {/* ---- Mercado Pago (Checkout Transparente) ---- */}
            <div className="space-y-4 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Mercado Pago ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Habilita PIX (QR dinâmico) e Cartão no checkout do app.
                  </p>
                </div>
                <Switch
                  checked={form.mp_ativo}
                  onCheckedChange={(v) => setForm({ ...form, mp_ativo: v })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mp-token">Access Token (secreto)</Label>
                <Input
                  id="mp-token"
                  type="password"
                  value={form.mp_access_token}
                  onChange={(e) => setForm({ ...form, mp_access_token: e.target.value })}
                  placeholder="APP_USR-... ou TEST-..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mp-pubkey">Public Key</Label>
                <Input
                  id="mp-pubkey"
                  value={form.mp_public_key}
                  onChange={(e) => setForm({ ...form, mp_public_key: e.target.value })}
                  placeholder="APP_USR-... ou TEST-..."
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mp-secret">Segredo do Webhook</Label>
                  <Input
                    id="mp-secret"
                    type="password"
                    value={form.mp_webhook_secret}
                    onChange={(e) => setForm({ ...form, mp_webhook_secret: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <select
                    value={form.mp_ambiente}
                    onChange={(e) => setForm({ ...form, mp_ambiente: e.target.value })}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="test">Teste (sandbox)</option>
                    <option value="prod">Produção</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
              <div>
                <Label className="cursor-pointer">Configuração ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Ao ativar, as demais configurações são desativadas.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
