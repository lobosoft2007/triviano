import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchPosAppBranding,
  uploadPosAppIcon,
  savePosAppBranding,
  validatePosAppIcon,
} from "@/lib/pos-app-branding";
import { empresaAdminConfigQueryOptions } from "@/lib/empresa";

const MAX_LABEL = 30;

export function PosAppBrandingSection() {
  const qc = useQueryClient();
  const brandingQ = useQuery({
    queryKey: ["pos-app-branding"],
    queryFn: fetchPosAppBranding,
  });
  const empresaQ = useQuery(empresaAdminConfigQueryOptions);

  const [label, setLabel] = useState("");
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Hydrate form when data loads.
  useEffect(() => {
    if (brandingQ.data?.app_label) {
      setLabel(brandingQ.data.app_label);
    } else if (empresaQ.data?.nome_fantasia && !label) {
      setLabel(`${empresaQ.data.nome_fantasia} – Garçom`.slice(0, MAX_LABEL));
    }
    if (brandingQ.data?.icon_display_url && !previewUrl) {
      setPreviewUrl(brandingQ.data.icon_display_url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandingQ.data, empresaQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      savePosAppBranding({
        app_label: label,
        icon_path: pendingPath ?? brandingQ.data?.icon_path ?? null,
      }),
    onSuccess: () => {
      toast.success("Branding do app salvo.");
      setPendingPath(null);
      qc.invalidateQueries({ queryKey: ["pos-app-branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onPickIcon(file: File) {
    try {
      setUploading(true);
      await validatePosAppIcon(file);
      const path = await uploadPosAppIcon(file);
      setPendingPath(path);
      setPreviewUrl(URL.createObjectURL(file));
      toast.success("Ícone carregado. Clique em Salvar para confirmar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  const dirty =
    pendingPath !== null ||
    (brandingQ.data ? label !== brandingQ.data.app_label : label.trim().length > 0);

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold">Identidade do app (whitelabel)</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o ícone e o nome que aparecerão na maquininha para os garçons.
          Depois de salvar, o time Triviano gera o APK personalizado da sua empresa.
        </p>
      </div>

      <div className="grid gap-6 rounded-xl border border-border bg-card p-6 md:grid-cols-[220px_1fr]">
        {/* -------- Icon preview + upload -------- */}
        <div className="flex flex-col items-center gap-3">
          <div className="grid grid-cols-3 gap-3">
            <IconPreview url={previewUrl} shape="squircle" label="Squircle" />
            <IconPreview url={previewUrl} shape="circle" label="Círculo" />
            <IconPreview url={previewUrl} shape="rounded" label="Quadrado" />
          </div>

          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {previewUrl ? "Trocar ícone" : "Enviar ícone"}
            <input
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickIcon(f);
                e.target.value = "";
              }}
            />
          </label>

          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            PNG quadrado, mínimo 512x512. Ideal: 1024x1024. O motivo principal
            deve caber em 66% centrais (área segura do launcher Android).
          </p>
        </div>

        {/* -------- Label form -------- */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="app-label">Nome do app (aparece no launcher)</Label>
            <Input
              id="app-label"
              value={label}
              maxLength={MAX_LABEL}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Clube 23 – Garçom"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {label.length}/{MAX_LABEL} caracteres. O Android trunca nomes maiores.
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Como o APK é gerado</p>
            <p>
              Depois que você salvar, o time Triviano roda o gerador que baixa
              este ícone e nome, monta um APK exclusivo para a sua empresa e
              devolve o arquivo pronto para instalar na maquininha. Você pode
              atualizar quando quiser — basta enviar o novo ícone e pedir uma
              nova versão.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={
                !dirty ||
                saveMut.isPending ||
                label.trim().length === 0 ||
                label.length > MAX_LABEL
              }
            >
              {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar branding
            </Button>
            {brandingQ.data?.updated_at && (
              <span className="text-xs text-muted-foreground">
                Atualizado em {new Date(brandingQ.data.updated_at).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function IconPreview({
  url,
  shape,
  label,
}: {
  url: string | null;
  shape: "circle" | "squircle" | "rounded";
  label: string;
}) {
  const radius =
    shape === "circle" ? "rounded-full" : shape === "squircle" ? "rounded-[28%]" : "rounded-xl";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`h-16 w-16 overflow-hidden border border-border bg-muted ${radius} flex items-center justify-center`}
      >
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted-foreground">sem ícone</span>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
