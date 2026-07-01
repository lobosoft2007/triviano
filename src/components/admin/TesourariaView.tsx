import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  TrendingUp,
  Landmark,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  listContasFinanceiras,
  saveContaFinanceira,
  deleteContaFinanceira,
  fetchPainelFinanceiro,
  listLancamentos,
  type ContaFinanceira,
  type TipoConta,
} from "@/lib/tesouraria";
import { fetchMeiosPagamento } from "@/lib/caixa";
import { parseNumberInput } from "@/lib/erp";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconBtn } from "./SetoresCrud";
import { Field } from "./FornecedoresCrud";

const NONE = "__none__";

const TIPO_OPTIONS: { value: TipoConta; label: string }[] = [
  { value: "Físico", label: "Físico (gaveta/cofre)" },
  { value: "Banco", label: "Banco (conta corrente)" },
  { value: "Recebível_Futuro", label: "Recebível futuro (cartão)" },
];

const tipoIcon = (t: TipoConta) =>
  t === "Banco" ? Landmark : t === "Recebível_Futuro" ? CreditCard : Wallet;

interface FormState {
  id: string | null;
  nome: string;
  tipo_conta: TipoConta;
  ativo: boolean;
  id_meio_pagamento: string;
  taxa_percentual: string;
  dias_liquidacao: string;
  saldo_atual: string;
}

const EMPTY: FormState = {
  id: null,
  nome: "",
  tipo_conta: "Físico",
  ativo: true,
  id_meio_pagamento: NONE,
  taxa_percentual: "0",
  dias_liquidacao: "0",
  saldo_atual: "0",
};

export function TesourariaView() {
  const queryClient = useQueryClient();
  const { data: painel, isLoading } = useQuery({
    queryKey: ["tesouraria-painel"],
    queryFn: () => fetchPainelFinanceiro(30),
  });
  const { data: lancamentos } = useQuery({
    queryKey: ["tesouraria-lancamentos"],
    queryFn: () => listLancamentos(60),
  });
  const { data: meios } = useQuery({
    queryKey: ["meios-pagamento-all"],
    queryFn: () => fetchMeiosPagamento(false),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (c: ContaFinanceira) => {
    setForm({
      id: c.id,
      nome: c.nome,
      tipo_conta: c.tipo_conta,
      ativo: c.ativo,
      id_meio_pagamento: c.id_meio_pagamento ?? NONE,
      taxa_percentual: String(c.taxa_percentual).replace(".", ","),
      dias_liquidacao: String(c.dias_liquidacao),
      saldo_atual: String(c.saldo_atual).replace(".", ","),
    });
    setOpen(true);
  };

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da conta.");
      return;
    }
    setSaving(true);
    try {
      await saveContaFinanceira({
        id: form.id,
        nome: form.nome,
        tipo_conta: form.tipo_conta,
        ativo: form.ativo,
        id_meio_pagamento:
          form.id_meio_pagamento === NONE ? null : form.id_meio_pagamento,
        taxa_percentual: parseNumberInput(form.taxa_percentual),
        dias_liquidacao: Number(form.dias_liquidacao) || 0,
        saldo_atual: parseNumberInput(form.saldo_atual),
      });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["tesouraria-painel"] });
      toast.success("Conta salva!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: ContaFinanceira) {
    if (!confirm(`Remover a conta "${c.nome}"?`)) return;
    try {
      await deleteContaFinanceira(c.id);
      await queryClient.invalidateQueries({ queryKey: ["tesouraria-painel"] });
      toast.success("Conta removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const contas = painel?.contas ?? [];
  const projecaoFinal =
    painel?.projecao[painel.projecao.length - 1]?.saldoAcumulado ?? 0;

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">
            Painel Financeiro & Fluxo de Caixa
          </h2>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova conta
        </Button>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-medium text-muted-foreground">
            Saldo consolidado (contas)
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">
            {formatBRL(painel?.saldoConsolidado ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-medium text-muted-foreground">
            Recebíveis futuros (até D+30)
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatBRL(painel?.recebiveisFuturos ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-medium text-muted-foreground">
            Saldo projetado em D+30
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-primary">
            {formatBRL(projecaoFinal)}
          </p>
        </div>
      </div>

      {/* Projection chart */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <h3 className="mb-3 text-sm font-bold">
          Projeção de fluxo de caixa (30 dias)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={painel?.projecao ?? []}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={4}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={64}
                stroke="currentColor"
                className="text-muted-foreground"
                tickFormatter={(v) => formatBRL(Number(v))}
              />
              <Tooltip
                formatter={(v: number) => formatBRL(Number(v))}
                labelFormatter={(l) => `Dia ${l}`}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="saldoAcumulado"
                name="Saldo projetado"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accounts grid */}
      <div>
        <h3 className="mb-3 text-sm font-bold">Contas &amp; gaveteiros</h3>
        {contas.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
            Nenhuma conta cadastrada.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {contas.map((c) => {
              const Icon = tipoIcon(c.tipo_conta);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {c.nome}
                      {!c.ativo && (
                        <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          inativa
                        </span>
                      )}
                    </p>
                    <p className="text-sm font-bold tabular-nums text-primary">
                      {formatBRL(c.saldo_atual)}
                    </p>
                    {c.tipo_conta === "Recebível_Futuro" && (
                      <p className="text-[11px] text-muted-foreground">
                        Taxa {c.taxa_percentual}% · D+{c.dias_liquidacao}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <IconBtn label="Editar" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      label="Remover"
                      destructive
                      onClick={() => handleDelete(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent movements */}
      <div>
        <h3 className="mb-3 text-sm font-bold">Lançamentos recentes</h3>
        {(lancamentos?.length ?? 0) === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
            Nenhum lançamento registrado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Conta</th>
                  <th className="px-4 py-2.5 font-semibold">Categoria</th>
                  <th className="px-4 py-2.5 font-semibold">Descrição</th>
                  <th className="px-4 py-2.5 font-semibold">Liquidação</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos!.map((l, idx) => (
                  <tr
                    key={l.id}
                    className={idx > 0 ? "border-t border-border" : ""}
                  >
                    <td className="px-4 py-2.5 font-medium">{l.conta_nome}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {l.categoria_fluxo}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground">
                      {l.descricao}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {new Date(l.data_liquidacao).toLocaleDateString("pt-BR")}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                        l.tipo === "Entrada"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {l.tipo === "Entrada" ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        )}
                        {formatBRL(l.valor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {form.id ? "Editar conta" : "Nova conta financeira"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Caixa Pequeno / Cofre"
              />
            </Field>
            <Field label="Tipo de conta">
              <Select
                value={form.tipo_conta}
                onValueChange={(v) =>
                  setForm({ ...form, tipo_conta: v as TipoConta })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Saldo atual (R$)">
              <Input
                inputMode="decimal"
                value={form.saldo_atual}
                onChange={(e) =>
                  setForm({ ...form, saldo_atual: e.target.value })
                }
                placeholder="0,00"
              />
            </Field>
            {form.tipo_conta === "Recebível_Futuro" && (
              <>
                <Field label="Meio de pagamento (maquininha)" className="sm:col-span-2">
                  <Select
                    value={form.id_meio_pagamento}
                    onValueChange={(v) =>
                      setForm({ ...form, id_meio_pagamento: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {meios?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Taxa da maquininha (%)">
                  <Input
                    inputMode="decimal"
                    value={form.taxa_percentual}
                    onChange={(e) =>
                      setForm({ ...form, taxa_percentual: e.target.value })
                    }
                    placeholder="3,5"
                  />
                </Field>
                <Field label="Prazo de liquidação (dias)">
                  <Input
                    inputMode="numeric"
                    value={form.dias_liquidacao}
                    onChange={(e) =>
                      setForm({ ...form, dias_liquidacao: e.target.value })
                    }
                    placeholder="30"
                  />
                </Field>
              </>
            )}
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5 sm:col-span-2">
              <Label className="cursor-pointer">Conta ativa</Label>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
