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
  mp_public_key_prod: string;
  mp_access_token_prod: string;
  mp_public_key_test: string;
  mp_access_token_test: string;
  mp_webhook_secret: string;
  mp_ativo: boolean;
  mp_ambiente: string;
  aceita_pix_online: boolean;
  aceita_cartao_online: boolean;
  aceita_na_entrega: boolean;
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
  mp_public_key_prod: "",
  mp_access_token_prod: "",
  mp_public_key_test: "",
  mp_access_token_test: "",
  mp_webhook_secret: "",
  mp_ativo: false,
  mp_ambiente: "test",
  aceita_pix_online: true,
  aceita_cartao_online: true,
  aceita_na_entrega: true,
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
      mp_public_key_prod: c.mp_public_key_prod,
      mp_access_token_prod: c.mp_access_token_prod,
      mp_public_key_test: c.mp_public_key_test,
      mp_access_token_test: c.mp_access_token_test,
      mp_webhook_secret: c.mp_webhook_secret,
      mp_ativo: c.mp_ativo,
      mp_ambiente: c.mp_ambiente || "test",
      aceita_pix_online: c.aceita_pix_online,
      aceita_cartao_online: c.aceita_cartao_online,
      aceita_na_entrega: c.aceita_na_entrega,
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
                <Label>Ambiente em uso</Label>
                <select
                  value={form.mp_ambiente}
                  onChange={(e) => setForm({ ...form, mp_ambiente: e.target.value })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="test">Teste (sandbox)</option>
                  <option value="prod">Produção</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  O checkout usa automaticamente as chaves do ambiente
                  selecionado. Deixe as duas configurações salvas e alterne aqui
                  com um clique.
                </p>
              </div>

              {/* Chaves de PRODUÇÃO */}
              <div
                className={`space-y-3 rounded-lg border p-3 ${
                  form.mp_ambiente === "prod"
                    ? "border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-900/10"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Produção</span>
                  {form.mp_ambiente === "prod" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Em uso
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mp-pubkey-prod">Public Key (Produção)</Label>
                  <Input
                    id="mp-pubkey-prod"
                    value={form.mp_public_key_prod}
                    onChange={(e) =>
                      setForm({ ...form, mp_public_key_prod: e.target.value })
                    }
                    placeholder="APP_USR-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mp-token-prod">Access Token (Produção)</Label>
                  <Input
                    id="mp-token-prod"
                    type="password"
                    value={form.mp_access_token_prod}
                    onChange={(e) =>
                      setForm({ ...form, mp_access_token_prod: e.target.value })
                    }
                    placeholder="APP_USR-..."
                  />
                </div>
              </div>

              {/* Chaves de TESTE */}
              <div
                className={`space-y-3 rounded-lg border p-3 ${
                  form.mp_ambiente === "test"
                    ? "border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-900/10"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Teste / Sandbox</span>
                  {form.mp_ambiente === "test" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Em uso
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mp-pubkey-test">Public Key (Teste)</Label>
                  <Input
                    id="mp-pubkey-test"
                    value={form.mp_public_key_test}
                    onChange={(e) =>
                      setForm({ ...form, mp_public_key_test: e.target.value })
                    }
                    placeholder="TEST-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mp-token-test">Access Token (Teste)</Label>
                  <Input
                    id="mp-token-test"
                    type="password"
                    value={form.mp_access_token_test}
                    onChange={(e) =>
                      setForm({ ...form, mp_access_token_test: e.target.value })
                    }
                    placeholder="TEST-..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mp-secret">Segredo do Webhook</Label>
                <Input
                  id="mp-secret"
                  type="password"
                  value={form.mp_webhook_secret}
                  onChange={(e) => setForm({ ...form, mp_webhook_secret: e.target.value })}
                />
              </div>
            </div>

            {/* ---- 3 Panoramas de Flexibilidade ---- */}
            <div className="space-y-3 rounded-xl border border-border p-3">
              <div>
                <Label>Panoramas de flexibilidade</Label>
                <p className="text-xs text-muted-foreground">
                  Controle quais formas de pagamento aparecem para o cliente no
                  checkout do app.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5">
                <div>
                  <Label className="cursor-pointer">PIX Online</Label>
                  <p className="text-xs text-muted-foreground">
                    QR dinâmico pago dentro do app.
                  </p>
                </div>
                <Switch
                  checked={form.aceita_pix_online}
                  onCheckedChange={(v) => setForm({ ...form, aceita_pix_online: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5">
                <div>
                  <Label className="cursor-pointer">Cartão Online</Label>
                  <p className="text-xs text-muted-foreground">
                    Crédito/débito processado no checkout.
                  </p>
                </div>
                <Switch
                  checked={form.aceita_cartao_online}
                  onCheckedChange={(v) => setForm({ ...form, aceita_cartao_online: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5">
                <div>
                  <Label className="cursor-pointer">Pagamento na Entrega</Label>
                  <p className="text-xs text-muted-foreground">
                    Dinheiro e maquininha na entrega/retirada.
                  </p>
                </div>
                <Switch
                  checked={form.aceita_na_entrega}
                  onCheckedChange={(v) => setForm({ ...form, aceita_na_entrega: v })}
                />
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
