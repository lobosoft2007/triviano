import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Save,
  ShieldCheck,
  Upload,
  FileCheck2,
  FlaskConical,
  Rocket,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchFiscalConfig,
  saveFiscalConfig,
  type FiscalConfig,
} from "@/lib/fiscal/config";
import { uploadCertificate } from "@/lib/storage";
import { ManifestacaoView } from "@/components/caixa/ManifestacaoView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";


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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

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

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card">
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
                  setForm({ ...form, ambiente: opt.v as "homologacao" | "producao" })
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
              placeholder="https://api.tecnospeed.com.br"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cred-api-key">API Key</Label>
              <Input
                id="cred-api-key"
                value={form.credenciais.api_key || ""}
                onChange={(e) => updateCredenciais({ api_key: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-bearer">Bearer Token</Label>
              <Input
                id="cred-bearer"
                value={form.credenciais.bearer_token || ""}
                onChange={(e) => updateCredenciais({ bearer_token: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            As credenciais também podem ser configuradas via variáveis de ambiente
            TECNOSPEED_BASE_URL, TECNOSPEED_API_KEY e TECNOSPEED_BEARER_TOKEN.
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

      <ManifestacaoView />
    </section>
  );
}
