import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ImagePlus, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  empresaConfigQueryOptions,
  updateEmpresa,
  type EmpresaBranding,
} from "@/lib/empresa";
import { uploadEmpresaLogo } from "@/lib/storage";
import { compressImage } from "@/lib/imageCompression";
import { parseNumberInput } from "@/lib/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormState {
  nome_fantasia: string;
  taxa_servico_mesa: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  percentual_cashback: string;
  cashback_ativo: boolean;
}

function empresaToForm(e: EmpresaBranding): FormState {
  return {
    nome_fantasia: e.nome_fantasia,
    taxa_servico_mesa: String(e.taxa_servico_mesa).replace(".", ","),
    cep: e.cep,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.cidade,
    estado: e.estado,
    percentual_cashback: String(e.percentual_cashback).replace(".", ","),
    cashback_ativo: e.cashback_ativo,
  };
}

export function EmpresaConfigTab() {
  const queryClient = useQueryClient();
  const { data: empresa, isLoading } = useQuery(empresaConfigQueryOptions);

  const [form, setForm] = useState<FormState | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (empresa && !form) {
      setForm(empresaToForm(empresa));
      setPreview(empresa.logo_display_url);
    }
  }, [empresa, form]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const handleSave = async () => {
    if (!empresa || !form) return;
    if (!form.nome_fantasia.trim()) {
      toast.error("Informe o nome fantasia da empresa.");
      return;
    }
    const taxa = parseNumberInput(form.taxa_servico_mesa);
    if (taxa < 0 || taxa > 100) {
      toast.error("A taxa de serviço deve estar entre 0 e 100%.");
      return;
    }

    setSaving(true);
    try {
      let logoRef = empresa.logotipo_url;
      if (file) {
        const optimized = await compressImage(file);
        logoRef = await uploadEmpresaLogo(optimized);
      }

      await updateEmpresa(empresa.id, {
        nome_fantasia: form.nome_fantasia.trim(),
        logotipo_url: logoRef,
        taxa_servico_mesa: taxa,
        cep: form.cep.trim(),
        logradouro: form.logradouro.trim(),
        numero: form.numero.trim(),
        complemento: form.complemento.trim(),
        bairro: form.bairro.trim(),
        cidade: form.cidade.trim(),
        estado: form.estado.trim().toUpperCase(),
      });

      toast.success("Configurações da empresa salvas!");
      setFile(null);
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-bold">Configurações da Empresa</h2>
          <p className="text-xs text-muted-foreground">
            Identidade visual, taxa de serviço e endereço da empresa ativa.
          </p>
        </div>
      </div>

      {/* Logo */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <Label className="mb-2 block">Logotipo</Label>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
            {preview ? (
              <img src={preview} alt="Logotipo" className="h-full w-full object-contain" />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="mr-1 h-4 w-4" /> Escolher imagem
            </Button>
            <p className="text-xs text-muted-foreground">
              PNG ou JPG. Aparece no cabeçalho, login e cupons.
            </p>
          </div>
        </div>
      </section>

      {/* Identidade + taxa */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
          <Input
            id="nome_fantasia"
            value={form.nome_fantasia}
            onChange={(e) => set("nome_fantasia", e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxa">Taxa de Serviço nas Mesas (%)</Label>
          <Input
            id="taxa"
            inputMode="decimal"
            value={form.taxa_servico_mesa}
            onChange={(e) => set("taxa_servico_mesa", e.target.value)}
            placeholder="Ex: 10"
            className="h-11 rounded-xl"
          />
        </div>
      </section>

      {/* Endereço */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">Endereço completo</h3>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="cep">CEP</Label>
            <Input id="cep" value={form.cep} onChange={(e) => set("cep", e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-4">
            <Label htmlFor="logradouro">Logradouro</Label>
            <Input id="logradouro" value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="numero">Número</Label>
            <Input id="numero" value={form.numero} onChange={(e) => set("numero", e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-4">
            <Label htmlFor="complemento">Complemento</Label>
            <Input id="complemento" value={form.complemento} onChange={(e) => set("complemento", e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <Label htmlFor="bairro">Bairro</Label>
            <Input id="bairro" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-1">
            <Label htmlFor="estado">UF</Label>
            <Input id="estado" maxLength={2} value={form.estado} onChange={(e) => set("estado", e.target.value)} className="h-11 rounded-xl uppercase" />
          </div>
        </div>
      </section>

      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full rounded-2xl">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><Save className="mr-1 h-4 w-4" /> Salvar configurações</>)}
      </Button>
    </div>
  );
}
