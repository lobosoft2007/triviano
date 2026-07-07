import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Crown,
  Plus,
  Building2,
  Globe,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  useIsSuperAdmin,
  listAllEmpresas,
  createEmpresa,
  type NovaEmpresa,
} from "@/lib/superadmin";
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
import { AppShell, ShellHeader, ShellBody } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/superadmin")({
  component: SuperAdminPage,
});

const EMPTY_FORM: NovaEmpresa = {
  nome_fantasia: "",
  dominio_customizado: "",
  ativo: true,
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

function SuperAdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: isSuper, isLoading: roleLoading } = useIsSuperAdmin(user?.id);

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["superadmin-empresas"],
    queryFn: listAllEmpresas,
    enabled: isSuper === true,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NovaEmpresa>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof NovaEmpresa>(k: K, v: NovaEmpresa[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nome_fantasia.trim()) {
      toast.error("Informe o nome fantasia da nova empresa.");
      return;
    }
    setSaving(true);
    try {
      await createEmpresa(form);
      toast.success("Nova empresa cadastrada! Base pronta para receber produtos.");
      setOpen(false);
      setForm(EMPTY_FORM);
      await queryClient.invalidateQueries({ queryKey: ["superadmin-empresas"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível cadastrar.";
      toast.error(
        msg.includes("duplicate") || msg.includes("unique")
          ? "Este domínio customizado já está em uso."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  // Hard 403 gate — only the ecosystem owner (super_admin) passes.
  if (!isSuper) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <div>
          <h1 className="font-display text-lg font-bold">403 · Acesso negado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O Painel Master SaaS é exclusivo do proprietário do ecossistema.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    );
  }

  return (
    <AppShell>
      <ShellHeader className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/admin">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-display text-base font-bold leading-tight">
                Painel Master SaaS
              </h1>
              <p className="text-xs text-muted-foreground">
                Governança do ecossistema · acesso exclusivo
              </p>
            </div>
          </div>
          <Button
            className="ml-auto gap-1.5"
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>
            {empresas ? `${empresas.length} empresa(s) no ecossistema` : "Carregando…"}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {(empresas ?? []).map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{e.nome_fantasia}</h3>
                      {e.ativo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <XCircle className="h-3 w-3" /> Inativo
                        </span>
                      )}
                    </div>
                    {e.dominio_customizado ? (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" />
                        <span className="truncate">{e.dominio_customizado}</span>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground/70">
                        Sem domínio customizado
                      </div>
                    )}
                    {(e.cidade || e.estado) && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {[e.logradouro, e.numero].filter(Boolean).join(", ")}
                        {e.bairro ? ` · ${e.bairro}` : ""}
                        {e.cidade ? ` · ${e.cidade}` : ""}
                        {e.estado ? `/${e.estado}` : ""}
                      </p>
                    )}
                  </div>
                  <code className="shrink-0 rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                    {e.id.slice(0, 8)}
                  </code>
                </div>
              </div>
            ))}
            {empresas && empresas.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Nenhuma empresa cadastrada ainda.
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Nova Empresa (Novo Cliente)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome Fantasia</Label>
              <Input
                id="nome"
                value={form.nome_fantasia}
                onChange={(e) => set("nome_fantasia", e.target.value)}
                placeholder="Ex.: Pizzaria do Zé"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dominio">Domínio Customizado</Label>
              <Input
                id="dominio"
                value={form.dominio_customizado ?? ""}
                onChange={(e) => set("dominio_customizado", e.target.value)}
                placeholder="Ex.: pizzariadoze.com.br"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="ativo">Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Empresa habilitada no ecossistema
                </p>
              </div>
              <Switch
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(v) => set("ativo", v)}
              />
            </div>

            <div className="border-t border-border pt-3">
              <p className="mb-3 text-sm font-semibold">Endereço completo</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cep">CEP</Label>
                  <Input id="cep" value={form.cep} onChange={(e) => set("cep", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={form.numero}
                    onChange={(e) => set("numero", e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input
                    id="logradouro"
                    value={form.logradouro}
                    onChange={(e) => set("logradouro", e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    value={form.complemento}
                    onChange={(e) => set("complemento", e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={form.bairro}
                    onChange={(e) => set("bairro", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={form.cidade}
                    onChange={(e) => set("cidade", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estado">Estado (UF)</Label>
                  <Input
                    id="estado"
                    maxLength={2}
                    value={form.estado}
                    onChange={(e) => set("estado", e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
