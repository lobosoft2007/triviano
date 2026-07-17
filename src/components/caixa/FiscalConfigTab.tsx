import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Save,
  ShieldCheck,
  Upload,
  FileCheck2,
  FlaskConical,
  Rocket,
  AlertTriangle,
  PlugZap,
  Building2,
  KeyRound,
  Beaker,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchFiscalConfig,
  saveFiscalConfig,
  type FiscalConfig,
} from "@/lib/fiscal/config";
import { uploadCertificate } from "@/lib/storage";
import { ManifestacaoView } from "@/components/caixa/ManifestacaoView";
import {
  pingProvedorFiscal,
  sincronizarEmpresaFiscal,
  sincronizarCertificadoFiscal,
  emitirNFCeTeste,
} from "@/lib/fiscal/fiscal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const SANDBOX_URL = "https://api.sandbox.plugnotas.com.br";
const PROD_URL = "https://api.plugnotas.com.br";


const PROVIDERS = [
  { value: "tecnospeed", label: "Tecnospeed" },
  { value: "acbr", label: "ACBr (próprio)" },
  { value: "nativo", label: "Nativo (futuro)" },
] as const;

const REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
] as const;

export function FiscalConfigTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["fiscal-config"],
    queryFn: fetchFiscalConfig,
  });

  const [form, setForm] = useState<FiscalConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<null | "ping" | "empresa" | "cert" | "teste">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pingFn = useServerFn(pingProvedorFiscal);
  const syncEmpresaFn = useServerFn(sincronizarEmpresaFiscal);
  const syncCertFn = useServerFn(sincronizarCertificadoFiscal);
  const testeFn = useServerFn(emitirNFCeTeste);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function setAmbiente(v: "homologacao" | "producao") {
    if (!form) return;
    const currentUrl = form.credenciais.base_url || "";
    const isDefaultUrl =
      !currentUrl || currentUrl === SANDBOX_URL || currentUrl === PROD_URL;
    setForm({
      ...form,
      ambiente: v,
      credenciais: {
        ...form.credenciais,
        base_url: isDefaultUrl
          ? v === "producao"
            ? PROD_URL
            : SANDBOX_URL
          : currentUrl,
      },
    });
  }

  async function runAction(
    key: "ping" | "empresa" | "cert" | "teste",
    fn: () => Promise<unknown>,
    successMsg: (r: any) => string,
  ) {
    if (!form?.empresa_id) return;
    setBusy(key);
    try {
      const r: any = await fn();
      if (r && r.sucesso === false) {
        toast.error(r.mensagem || "Falha na operação.");
      } else if (r && r.ok === false) {
        toast.error(`Provedor respondeu HTTP ${r.status}.`);
      } else {
        toast.success(successMsg(r));
      }
      await queryClient.invalidateQueries({ queryKey: ["fiscal-config"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    const ok = /\.(pfx|p12)$/i.test(file.name);
    if (!ok) {
      toast.error("Envie um arquivo .pfx ou .p12.");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadCertificate(file);
      setForm({
        ...form,
        certificado_a1_path: path,
        certificado_a1_nome: file.name,
      });
      toast.success("Certificado enviado com segurança.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      await saveFiscalConfig(form);
      await queryClient.invalidateQueries({ queryKey: ["fiscal-config"] });
      toast.success("Dados fiscais salvos.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function updateCredenciais(patch: Partial<FiscalConfig["credenciais"]>) {
    if (!form) return;
    setForm({
      ...form,
      credenciais: { ...form.credenciais, ...patch },
    });
  }

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">
            Configuração Fiscal & Certificado Digital A1
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure o provedor fiscal, ambiente de emissão e certificado A1.
          Os dados são criptografados e visíveis apenas a administradores.
        </p>
      </header>

      {!form.ativo && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Emissão fiscal desativada</p>
            <p className="opacity-90">
              Nenhuma nota fiscal está sendo gerada nas vendas desta empresa.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card">
        {/* Interruptor mestre de emissão */}
        <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4">
          <div className="min-w-0">
            <Label htmlFor="emissao-ativa" className="text-sm font-semibold">
              Emitir Nota Fiscal automaticamente em todas as vendas
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Recomendado. Desative apenas se a sua empresa optou temporariamente
              por operar sem emissão fiscal. As credenciais e o certificado
              permanecem salvos.
            </p>
          </div>
          <Switch
            id="emissao-ativa"
            checked={form.ativo}
            onCheckedChange={(v) => setForm({ ...form, ativo: v })}
          />
        </div>


        {/* Provedor */}
        <div className="space-y-2">
          <Label>Provedor fiscal</Label>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setForm({ ...form, provider: opt.value })}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  form.provider === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ambiente */}
        <div className="space-y-2">
          <Label>Ambiente de emissão</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "homologacao", label: "Homologação/Testes", icon: <FlaskConical className="h-4 w-4" /> },
              { v: "producao", label: "Produção", icon: <Rocket className="h-4 w-4" /> },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() =>
                  setAmbiente(opt.v as "homologacao" | "producao")
                }
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  form.ambiente === opt.v
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Regime tributário */}
        <div className="space-y-2">
          <Label>Regime tributário</Label>
          <div className="grid grid-cols-3 gap-2">
            {REGIMES.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setForm({
                    ...form,
                    regime_tributario: opt.value as FiscalConfig["regime_tributario"],
                  })
                }
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  form.regime_tributario === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Séries e números */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="serie-nfce">Série NFC-e</Label>
            <Input
              id="serie-nfce"
              value={form.serie_nfce}
              onChange={(e) => setForm({ ...form, serie_nfce: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numero-nfce">Próximo número NFC-e</Label>
            <Input
              id="numero-nfce"
              type="number"
              min={1}
              value={form.numero_nfce_proximo}
              onChange={(e) =>
                setForm({
                  ...form,
                  numero_nfce_proximo: Number(e.target.value) || 1,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serie-nfe">Série NF-e</Label>
            <Input
              id="serie-nfe"
              value={form.serie_nfe}
              onChange={(e) => setForm({ ...form, serie_nfe: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numero-nfe">Próximo número NF-e</Label>
            <Input
              id="numero-nfe"
              type="number"
              min={1}
              value={form.numero_nfe_proximo}
              onChange={(e) =>
                setForm({
                  ...form,
                  numero_nfe_proximo: Number(e.target.value) || 1,
                })
              }
            />
          </div>
        </div>

        {/* Credenciais do provedor */}
        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
          <h3 className="text-sm font-semibold">Credenciais do provedor</h3>
          <div className="space-y-2">
            <Label htmlFor="cred-base-url">URL base da API</Label>
            <Input
              id="cred-base-url"
              value={form.credenciais.base_url || ""}
              onChange={(e) => updateCredenciais({ base_url: e.target.value })}
              placeholder={form.ambiente === "producao" ? PROD_URL : SANDBOX_URL}
            />
            <p className="text-xs text-muted-foreground">
              PlugNotas (Tecnospeed): sandbox {SANDBOX_URL} · produção {PROD_URL}.
              A URL é ajustada automaticamente ao trocar o ambiente.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cred-api-key">API Key (header x-api-key)</Label>
              <Input
                id="cred-api-key"
                value={form.credenciais.api_key || ""}
                onChange={(e) => updateCredenciais({ api_key: e.target.value })}
                placeholder="cole aqui a chave do PlugNotas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-bearer">Bearer Token (opcional / legado)</Label>
              <Input
                id="cred-bearer"
                value={form.credenciais.bearer_token || ""}
                onChange={(e) => updateCredenciais({ bearer_token: e.target.value })}
                placeholder="não usado pelo PlugNotas"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Alternativa: defina TECNOSPEED_BASE_URL / TECNOSPEED_API_KEY no ambiente do servidor.
          </p>
        </div>

        {/* Certificate upload */}
        <div className="space-y-2">
          <Label>Arquivo do certificado (.pfx / .p12)</Label>
          <input
            ref={fileRef}
            type="file"
            accept=".pfx,.p12,application/x-pkcs12"
            onChange={handleFile}
            className="hidden"
          />
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              {form.certificado_a1_path ? (
                <FileCheck2 className="h-5 w-5" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {form.certificado_a1_nome || "Nenhum certificado enviado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {form.certificado_a1_path
                  ? "Armazenado com segurança"
                  : "Selecione o arquivo do certificado A1"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Selecionar"
              )}
            </Button>
          </div>
        </div>

        {/* Validade + senha */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cert-validade">Validade do certificado</Label>
            <Input
              id="cert-validade"
              type="date"
              value={form.certificado_a1_validade || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  certificado_a1_validade: e.target.value || null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cert-senha">Senha do certificado</Label>
            <Input
              id="cert-senha"
              type="password"
              value={form.certificado_a1_senha}
              onChange={(e) =>
                setForm({ ...form, certificado_a1_senha: e.target.value })
              }
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar configuração fiscal
        </Button>
      </div>

      {form.ambiente === "homologacao" && form.provider === "tecnospeed" && (
        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            <h3 className="font-display text-base font-bold">
              Sandbox PlugNotas — checklist de homologação
            </h3>
          </div>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Salve a configuração com API Key do sandbox e certificado A1 + senha.</li>
            <li>Clique em <b>Ping</b> para verificar conectividade.</li>
            <li>Clique em <b>Sincronizar empresa</b> para cadastrar o emitente no PlugNotas.</li>
            <li>Clique em <b>Sincronizar certificado</b> para enviar o .pfx ao provedor.</li>
            <li>Clique em <b>Emitir NFC-e de teste</b> (R$ 0,01) e valide status "autorizada".</li>
          </ol>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={busy !== null || !form.empresa_id}
              onClick={() =>
                runAction("ping", () => pingFn({ data: { empresa_id: form.empresa_id! } }), (r) =>
                  `Ping OK · HTTP ${r.status} · ${r.latency_ms}ms`,
                )
              }
            >
              {busy === "ping" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="mr-2 h-4 w-4" />
              )}
              Ping provedor
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null || !form.empresa_id}
              onClick={() =>
                runAction(
                  "empresa",
                  () => syncEmpresaFn({ data: { empresa_id: form.empresa_id! } }),
                  () => "Empresa sincronizada com o provedor.",
                )
              }
            >
              {busy === "empresa" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="mr-2 h-4 w-4" />
              )}
              Sincronizar empresa
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null || !form.empresa_id || !form.certificado_a1_path}
              onClick={() =>
                runAction(
                  "cert",
                  () => syncCertFn({ data: { empresa_id: form.empresa_id! } }),
                  () => "Certificado A1 enviado ao provedor.",
                )
              }
            >
              {busy === "cert" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Sincronizar certificado
            </Button>
            <Button
              disabled={busy !== null || !form.empresa_id}
              onClick={() =>
                runAction(
                  "teste",
                  () => testeFn({ data: { empresa_id: form.empresa_id! } }),
                  (r) =>
                    r?.status === "autorizada"
                      ? `NFC-e autorizada! Chave ${r.chave_acesso?.slice(-8) ?? ""}`
                      : `Retorno: ${r?.status ?? "sem status"}${r?.mensagem ? " · " + r.mensagem : ""}`,
                )
              }
            >
              {busy === "teste" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              Emitir NFC-e de teste
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Emissões de teste ficam registradas em Notas Fiscais com
            ambiente=homologação e não geram numeração de produção.
          </p>
        </div>
      )}

      <ManifestacaoView />
    </section>
  );
}
