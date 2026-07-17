import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ImagePlus, Building2, Save, Bike, Bot } from "lucide-react";
import { toast } from "sonner";
import {
  empresaAdminConfigQueryOptions,
  updateEmpresa,
  type EmpresaBranding,
} from "@/lib/empresa";
import { uploadEmpresaLogo } from "@/lib/storage";
import { compressImage } from "@/lib/imageCompression";
import { parseNumberInput } from "@/lib/erp";
import { applyIfoodMarkup } from "@/lib/ifood";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface FormState {
  nome_fantasia: string;
  taxa_servico_mesa: string;
  taxa_entrega_valor: string;
  cnpj: string;
  inscricao_estadual: string;
  regime_tributario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  percentual_cashback: string;
  cashback_ativo: boolean;
  monitor_cozinha: boolean;
  monitor_bar: boolean;
  monitor_pizzaria: boolean;
  ai_report_model: string;
  markup_ifood_percentual: string;
}

function empresaToForm(e: EmpresaBranding, markup: number): FormState {
  return {
    nome_fantasia: e.nome_fantasia,
    taxa_servico_mesa: String(e.taxa_servico_mesa).replace(".", ","),
    taxa_entrega_valor: String(e.taxa_entrega_valor).replace(".", ","),
    cnpj: e.cnpj ?? "",
    inscricao_estadual: e.inscricao_estadual ?? "",
    regime_tributario: e.regime_tributario ?? "simples_nacional",
    cep: e.cep,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.cidade,
    estado: e.estado,
    percentual_cashback: String(e.percentual_cashback).replace(".", ","),
    cashback_ativo: e.cashback_ativo,
    monitor_cozinha: e.monitor_cozinha,
    monitor_bar: e.monitor_bar,
    monitor_pizzaria: e.monitor_pizzaria,
    ai_report_model: e.ai_report_model ?? "openai/gpt-5.5",
    markup_ifood_percentual: String(markup).replace(".", ","),
  };
}


export function EmpresaConfigTab() {
  const queryClient = useQueryClient();
  const { data: empresa, isLoading, error } = useQuery({
    ...empresaAdminConfigQueryOptions,
    retry: false,
  });
  const { data: markupData } = useQuery({
    queryKey: ["empresa-markup-ifood", empresa?.id],
    enabled: !!empresa?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("markup_ifood_percentual")
        .eq("id", empresa!.id)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.markup_ifood_percentual ?? 0);
    },
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [applyingMarkup, setApplyingMarkup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (empresa && !form && markupData !== undefined) {
      setForm(empresaToForm(empresa, markupData ?? 0));
      setPreview(empresa.logo_display_url);
    }
  }, [empresa, form, markupData]);

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
    const taxaEntrega = parseNumberInput(form.taxa_entrega_valor);
    if (taxaEntrega < 0) {
      toast.error("A taxa de entrega não pode ser negativa.");
      return;
    }
    const pctCashback = parseNumberInput(form.percentual_cashback);
    if (pctCashback < 0 || pctCashback > 100) {
      toast.error("O percentual de cashback deve estar entre 0 e 100%.");
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
        taxa_entrega_valor: taxaEntrega,
        cnpj: form.cnpj.trim().replace(/\D/g, ""),
        inscricao_estadual: form.inscricao_estadual.trim(),
        regime_tributario: form.regime_tributario,
        cep: form.cep.trim(),
        logradouro: form.logradouro.trim(),
        numero: form.numero.trim(),
        complemento: form.complemento.trim(),
        bairro: form.bairro.trim(),
        cidade: form.cidade.trim(),
        estado: form.estado.trim().toUpperCase(),
        percentual_cashback: pctCashback,
        cashback_ativo: form.cashback_ativo,
        monitor_cozinha: form.monitor_cozinha,
        monitor_bar: form.monitor_bar,
        monitor_pizzaria: form.monitor_pizzaria,
        ai_report_model: form.ai_report_model,
      });

      // Markup iFood: persistido em coluna separada (não está no RPC do admin).
      const markupPct = parseNumberInput(form.markup_ifood_percentual);
      await supabase
        .from("empresas")
        .update({ markup_ifood_percentual: markupPct })
        .eq("id", empresa.id);

      toast.success("Configurações da empresa salvas!");
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["empresa-ativa"] });
      await queryClient.invalidateQueries({ queryKey: ["empresa-config"] });
      await queryClient.invalidateQueries({ queryKey: ["empresa-admin-config"] });
      await queryClient.invalidateQueries({ queryKey: ["empresa-markup-ifood"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyMarkup = async (overwrite: boolean) => {
    if (!empresa || !form) return;
    const pct = parseNumberInput(form.markup_ifood_percentual);
    if (pct <= 0) {
      toast.error("Defina um percentual de markup maior que zero antes.");
      return;
    }
    const msg = overwrite
      ? `Aplicar +${pct}% em TODOS os produtos (inclui os que já têm preço iFood definido)?`
      : `Aplicar +${pct}% apenas nos produtos SEM preço iFood definido?`;
    if (!confirm(msg)) return;

    setApplyingMarkup(true);
    try {
      // Grava o markup antes de aplicar para garantir consistência.
      await supabase
        .from("empresas")
        .update({ markup_ifood_percentual: pct })
        .eq("id", empresa.id);
      const count = await applyIfoodMarkup(empresa.id, overwrite);
      toast.success(
        `Markup aplicado. ${count} produto(s) atualizado(s) no nível principal (variações e adicionais também recalculados).`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aplicar markup.");
    } finally {
      setApplyingMarkup(false);
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
    <div className="w-full space-y-6">
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
          <Label htmlFor="taxa">Gorjeta sugerida nas mesas (%)</Label>
          <Input
            id="taxa"
            inputMode="decimal"
            value={form.taxa_servico_mesa}
            onChange={(e) => set("taxa_servico_mesa", e.target.value)}
            placeholder="Ex: 10"
            className="h-11 rounded-xl"
          />
          <p className="text-[11px] text-muted-foreground">
            Percentual sugerido no fechamento da comanda. O caixa/cliente pode aceitar
            ou remover. 0% desliga a sugestão.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxa_entrega">Taxa de entrega (R$)</Label>
          <Input
            id="taxa_entrega"
            inputMode="decimal"
            value={form.taxa_entrega_valor}
            onChange={(e) => set("taxa_entrega_valor", e.target.value)}
            placeholder="Ex: 6,00"
            className="h-11 rounded-xl"
          />
          <p className="text-[11px] text-muted-foreground">
            Valor fixo somado ao total dos pedidos de delivery no recebimento.
            R$&nbsp;0,00 desliga a cobrança.
          </p>
        </div>
      </section>

      {/* Dados fiscais */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">Dados Fiscais</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={form.cnpj}
              onChange={(e) => set("cnpj", e.target.value)}
              placeholder="00.000.000/0000-00"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ie">Inscrição Estadual</Label>
            <Input
              id="ie"
              value={form.inscricao_estadual}
              onChange={(e) => set("inscricao_estadual", e.target.value)}
              placeholder="ISENTO"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="regime_tributario">Regime Tributário</Label>
            <select
              id="regime_tributario"
              value={form.regime_tributario}
              onChange={(e) => set("regime_tributario", e.target.value)}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>
        </div>
      </section>

      {/* Cashback */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">Cashback</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pct_cashback">Percentual de Cashback (%)</Label>
            <Input
              id="pct_cashback"
              inputMode="decimal"
              value={form.percentual_cashback}
              onChange={(e) => set("percentual_cashback", e.target.value)}
              placeholder="Ex: 5"
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Creditado ao cliente quando o pedido é concluído e pago. Pedidos no
              Fiado não geram cashback.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
            <Switch
              checked={form.cashback_ativo}
              onCheckedChange={(v: boolean) =>
                setForm((f) => (f ? { ...f, cashback_ativo: v } : f))
              }
            />
            <span className="text-sm font-medium">
              Cashback {form.cashback_ativo ? "ativado" : "desativado"}
            </span>
          </label>
        </div>
      </section>

      {/* Markup iFood — precificação por canal */}
      <section className="rounded-2xl border border-red-500/30 bg-red-50/40 p-4 dark:bg-red-900/10">
        <div className="mb-3 flex items-center gap-2">
          <Bike className="h-4 w-4 text-red-500" />
          <h3 className="font-display text-sm font-bold">Precificação iFood</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Percentual aplicado sobre o preço interno para compor o preço no iFood
          (absorve a comissão do marketplace). Use os botões abaixo para aplicar
          em massa no cardápio.
        </p>
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="markup_ifood">Markup iFood (%)</Label>
            <Input
              id="markup_ifood"
              inputMode="decimal"
              value={form.markup_ifood_percentual}
              onChange={(e) => set("markup_ifood_percentual", e.target.value)}
              placeholder="Ex: 30"
              className="h-11 rounded-xl"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleApplyMarkup(false)}
            disabled={applyingMarkup}
            className="h-11 rounded-xl"
          >
            {applyingMarkup ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Aplicar aos vazios"
            )}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => handleApplyMarkup(true)}
            disabled={applyingMarkup}
            className="h-11 rounded-xl"
          >
            {applyingMarkup ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Sobrescrever todos"
            )}
          </Button>
        </div>
      </section>

      {/* Monitores (KDS) x Impressão por setor */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-1 font-display text-sm font-bold">
          Monitores (KDS) x Impressão de produção
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Ligado: o pedido vai direto para a tela do monitor daquele setor (sem
          comanda impressa). Desligado: imprime automaticamente a comanda física
          na impressora térmica do setor ao finalizar (F12).
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              { key: "monitor_cozinha", label: "Cozinha" },
              { key: "monitor_bar", label: "Bar" },
              { key: "monitor_pizzaria", label: "Pizzaria" },
            ] as const
          ).map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3"
            >
              <div className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {form[key] ? "Monitor (KDS)" : "Imprime comanda"}
                </span>
              </div>
              <Switch
                checked={form[key]}
                onCheckedChange={(v: boolean) =>
                  setForm((f) => (f ? { ...f, [key]: v } : f))
                }
              />
            </label>
          ))}
        </div>
      </section>

      {/* Modelo de IA — Assistente de Relatórios */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Modelo de IA dos Relatórios</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Modelo usado pelo Assistente IA em <strong>Relatórios</strong>. Modelos OpenAI
          costumam seguir schemas mais rigorousamente; Gemini pode ser mais econômico.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai_report_model">Provedor / Modelo</Label>
            <select
              id="ai_report_model"
              value={form.ai_report_model}
              onChange={(e) => set("ai_report_model", e.target.value)}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="openai/gpt-5.5">OpenAI GPT-5.5 (padrão)</option>
              <option value="openai/gpt-5.4">OpenAI GPT-5.4</option>
              <option value="openai/gpt-5.4-mini">OpenAI GPT-5.4 Mini</option>
              <option value="openai/gpt-5.4-nano">OpenAI GPT-5.4 Nano</option>
              <option value="google/gemini-3.1-pro-preview">Google Gemini 3.1 Pro</option>
              <option value="google/gemini-3.5-flash">Google Gemini 3.5 Flash</option>
              <option value="google/gemini-3.1-flash-lite">Google Gemini 3.1 Flash Lite</option>
            </select>
          </div>
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
