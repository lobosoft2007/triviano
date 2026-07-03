import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Palette, Save, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import {
  empresaConfigQueryOptions,
  updateEmpresaTheme,
} from "@/lib/empresa";
import {
  brandThemeVars,
  coerceBrandTheme,
  isValidHex,
  type ModoFundo,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ThemeForm {
  cor_primaria: string;
  cor_secundaria: string;
  modo_fundo: ModoFundo;
}

/** A color field with a native swatch picker + editable hex input. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = isValidHex(value);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1FAA6A"
          className={valid ? "" : "border-destructive"}
        />
      </div>
      {!valid && (
        <p className="text-xs text-destructive">Use um hexadecimal válido (ex: #1FAA6A).</p>
      )}
    </div>
  );
}

/** Mini smartphone that renders a simulated menu recolored in real time. */
function LivePreview({ theme }: { theme: ThemeForm }) {
  const vars = brandThemeVars(theme) as React.CSSProperties;
  return (
    <div className="mx-auto w-[240px]">
      <div className="rounded-[2rem] border-[6px] border-neutral-800 bg-neutral-800 shadow-float">
        <div
          style={vars}
          className="h-[440px] overflow-hidden rounded-[1.5rem] bg-background text-foreground"
        >
          <div className="flex flex-col gap-3 p-3">
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div className="h-6 w-20 rounded bg-muted" />
              <div className="h-7 w-7 rounded-full bg-primary" />
            </div>
            {/* Hero highlight */}
            <div className="rounded-xl bg-primary p-3 text-primary-foreground">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
                Destaque do dia
              </p>
              <p className="text-sm font-bold">Combo especial</p>
            </div>
            {/* Category chips */}
            <div className="flex gap-1.5">
              <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
                Lanches
              </span>
              <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold text-accent-foreground">
                Bebidas
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
                Doces
              </span>
            </div>
            {/* Product cards */}
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-2 rounded-xl bg-card p-2">
                <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-1/2 rounded bg-muted" />
                  <p className="text-xs font-bold text-primary">R$ 29,90</p>
                </div>
              </div>
            ))}
            {/* CTA */}
            <button className="mt-1 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground">
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Pré-visualização em tempo real
      </p>
    </div>
  );
}

export function IdentidadeVisualTab() {
  const queryClient = useQueryClient();
  const { data: empresa, isLoading } = useQuery(empresaConfigQueryOptions);
  const [form, setForm] = useState<ThemeForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (empresa && !form) {
      setForm({
        cor_primaria: empresa.cor_primaria,
        cor_secundaria: empresa.cor_secundaria,
        modo_fundo: empresa.modo_fundo,
      });
    }
  }, [empresa, form]);

  const set = (patch: Partial<ThemeForm>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));

  const handleSave = async () => {
    if (!empresa || !form) return;
    if (!isValidHex(form.cor_primaria) || !isValidHex(form.cor_secundaria)) {
      toast.error("Corrija as cores antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      await updateEmpresaTheme(empresa.id, coerceBrandTheme(form));
      toast.success("Identidade visual salva! O app já está na nova paleta.");
      await queryClient.invalidateQueries({ queryKey: ["empresa-ativa"] });
      await queryClient.invalidateQueries({ queryKey: ["empresa-config"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Identidade Visual</h2>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Controls */}
        <div className="space-y-5">
          <ColorField
            label="Cor primária"
            value={form.cor_primaria}
            onChange={(v) => set({ cor_primaria: v })}
          />
          <ColorField
            label="Cor secundária"
            value={form.cor_secundaria}
            onChange={(v) => set({ cor_secundaria: v })}
          />

          <div className="space-y-1.5">
            <Label>Modo de fundo</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "dark", label: "Escuro (Premium)", icon: Moon },
                  { key: "light", label: "Claro (Minimal)", icon: Sun },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set({ modo_fundo: key })}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    form.modo_fundo === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              O fundo alterna apenas entre nossos dois temas legíveis, protegendo o
              contraste do Design System.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar identidade
          </Button>
        </div>

        {/* Live preview */}
        <div className="flex items-start justify-center">
          <LivePreview theme={form} />
        </div>
      </div>
    </div>
  );
}
