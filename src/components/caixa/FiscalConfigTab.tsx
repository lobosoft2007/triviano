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
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchFiscalConfig,
  saveFiscalConfig,
  type AmbienteEmissao,
  type FiscalConfig,
} from "@/lib/erp";
import { uploadCertificate } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
            Dados Fiscais & Certificado Digital A1
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuração de retaguarda para emissão de NFC-e. O arquivo do
          certificado é guardado em armazenamento seguro e visível apenas a
          administradores.
        </p>
      </header>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card">
        {/* Ambiente */}
        <div className="space-y-2">
          <Label>Ambiente de emissão</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  v: "Homologação/Testes",
                  icon: <FlaskConical className="h-4 w-4" />,
                },
                { v: "Produção", icon: <Rocket className="h-4 w-4" /> },
              ] as { v: AmbienteEmissao; icon: React.ReactNode }[]
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setForm({ ...form, ambiente_emissao: opt.v })}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  form.ambiente_emissao === opt.v
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {opt.icon}
                {opt.v}
              </button>
            ))}
          </div>
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
              value={
                form.certificado_a1_validade
                  ? form.certificado_a1_validade.slice(0, 10)
                  : ""
              }
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
          Salvar dados fiscais
        </Button>
      </div>
    </section>
  );
}
