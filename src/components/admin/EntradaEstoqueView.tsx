import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, PackagePlus, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  listInsumos,
  listFornecedores,
  listRevendaProdutos,
  parseNumberInput,
} from "@/lib/erp";
import {
  listContasFinanceiras,
  listEntradasAvulsas,
  registrarEntradaAvulsa,
  registrarEntradaProdutos,
} from "@/lib/tesouraria";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "./FornecedoresCrud";
import { IconBtn } from "./SetoresCrud";

const NONE = "__none__";

type Modo = "insumos" | "produtos";

interface LinhaItem {
  key: string;
  ref_id: string;
  quantidade: string;
  custo_unitario: string;
}

const newLinha = (): LinhaItem => ({
  key: crypto.randomUUID(),
  ref_id: "",
  quantidade: "",
  custo_unitario: "",
});

export function EntradaEstoqueView() {
  const queryClient = useQueryClient();
  const { data: insumos } = useQuery({
    queryKey: ["erp-insumos"],
    queryFn: listInsumos,
  });
  const { data: produtos } = useQuery({
    queryKey: ["erp-produtos-revenda"],
    queryFn: listRevendaProdutos,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
  });
  const { data: contas } = useQuery({
    queryKey: ["tesouraria-contas"],
    queryFn: listContasFinanceiras,
  });
  const { data: entradas } = useQuery({
    queryKey: ["entradas-avulsas"],
    queryFn: () => listEntradasAvulsas(30),
  });

  const [modo, setModo] = useState<Modo>("insumos");
  const [fornecedor, setFornecedor] = useState<string>(NONE);
  const [conta, setConta] = useState<string>(NONE);
  const [observacao, setObservacao] = useState("");
  const [linhas, setLinhas] = useState<LinhaItem[]>([newLinha()]);
  const [saving, setSaving] = useState(false);

  const contasFisicas = useMemo(
    () =>
      (contas ?? []).filter(
        (c) => c.ativo && c.tipo_conta !== "Recebível_Futuro",
      ),
    [contas],
  );

  const total = useMemo(
    () =>
      linhas.reduce(
        (sum, l) =>
          sum + parseNumberInput(l.quantidade) * parseNumberInput(l.custo_unitario),
        0,
      ),
    [linhas],
  );

  const insumoById = (id: string) => insumos?.find((i) => i.id === id);
  const produtoById = (id: string) => produtos?.find((p) => p.id === id);

  function updateLinha(key: string, patch: Partial<LinhaItem>) {
    setLinhas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }
  function addLinha() {
    setLinhas((prev) => [...prev, newLinha()]);
  }
  function removeLinha(key: string) {
    setLinhas((prev) =>
      prev.length === 1 ? prev : prev.filter((l) => l.key !== key),
    );
  }

  function resetForm() {
    setFornecedor(NONE);
    setConta(NONE);
    setObservacao("");
    setLinhas([newLinha()]);
  }

  function switchModo(next: Modo) {
    if (next === modo) return;
    setModo(next);
    setLinhas([newLinha()]);
  }

  async function handleConfirm() {
    const itens = linhas.filter(
      (l) => l.ref_id && parseNumberInput(l.quantidade) > 0,
    );
    if (itens.length === 0) {
      toast.error(
        modo === "insumos"
          ? "Adicione ao menos um insumo com quantidade."
          : "Adicione ao menos um produto com quantidade.",
      );
      return;
    }
    setSaving(true);
    try {
      let numero: number;
      if (modo === "insumos") {
        numero = await registrarEntradaAvulsa({
          id_fornecedor: fornecedor === NONE ? null : fornecedor,
          id_conta_financeira: conta === NONE ? null : conta,
          observacao,
          itens: itens.map((l) => ({
            id_insumo: l.ref_id,
            quantidade: parseNumberInput(l.quantidade),
            custo_unitario: parseNumberInput(l.custo_unitario),
          })),
        });
      } else {
        numero = await registrarEntradaProdutos({
          id_fornecedor: fornecedor === NONE ? null : fornecedor,
          id_conta_financeira: conta === NONE ? null : conta,
          observacao,
          itens: itens.map((l) => ({
            id_produto: l.ref_id,
            quantidade: parseNumberInput(l.quantidade),
            custo_unitario: parseNumberInput(l.custo_unitario),
          })),
        });
      }
      toast.success(`Entrada nº ${numero} confirmada!`);
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["entradas-avulsas"] }),
        queryClient.invalidateQueries({ queryKey: ["erp-insumos"] }),
        queryClient.invalidateQueries({ queryKey: ["erp-produtos-revenda"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-menu"] }),
        queryClient.invalidateQueries({ queryKey: ["tesouraria-painel"] }),
        queryClient.invalidateQueries({ queryKey: ["tesouraria-contas"] }),
      ]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao confirmar entrada.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-2">
        <PackagePlus className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">
          Entrada de Estoque Avulsa
        </h2>
      </header>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        {/* Mode selector */}
        <div className="flex gap-1.5 rounded-xl bg-secondary p-1">
          {(
            [
              { key: "insumos", label: "Lançar Insumos" },
              { key: "produtos", label: "Lançar Produtos (Revenda)" },
            ] as { key: Modo; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchModo(t.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                modo === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fornecedor">
            <Select value={fornecedor} onValueChange={setFornecedor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem fornecedor</SelectItem>
                {fornecedores?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.fornecedor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pagar com a conta">
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não lançar no financeiro</SelectItem>
                {contasFisicas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Dynamic item list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {modo === "insumos" ? "Insumos" : "Produtos (revenda)"}
            </p>
            <Button size="sm" variant="secondary" onClick={addLinha}>
              <Plus className="mr-1 h-4 w-4" />
              {modo === "insumos" ? "Adicionar insumo" : "Adicionar produto"}
            </Button>
          </div>

          {linhas.map((l) => {
            const insumo = modo === "insumos" ? insumoById(l.ref_id) : undefined;
            const produto = modo === "produtos" ? produtoById(l.ref_id) : undefined;
            const unidade = insumo?.unidade_estoque ?? "un";
            return (
              <div
                key={l.key}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-secondary/50 p-2.5 sm:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <Select
                  value={l.ref_id || undefined}
                  onValueChange={(v) => {
                    if (modo === "insumos") {
                      const ins = insumoById(v);
                      updateLinha(l.key, {
                        ref_id: v,
                        custo_unitario:
                          l.custo_unitario ||
                          (ins ? String(ins.custo_unitario).replace(".", ",") : ""),
                      });
                    } else {
                      const prod = produtoById(v);
                      updateLinha(l.key, {
                        ref_id: v,
                        custo_unitario:
                          l.custo_unitario ||
                          (prod ? String(prod.custo_compra).replace(".", ",") : ""),
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={modo === "insumos" ? "Insumo" : "Produto"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {modo === "insumos"
                      ? insumos?.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.nome} ({i.unidade_estoque})
                          </SelectItem>
                        ))
                      : produtos?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="decimal"
                  placeholder={
                    modo === "insumos" ? `Qtd. (${unidade})` : "Qtd. (un)"
                  }
                  value={l.quantidade}
                  onChange={(e) =>
                    updateLinha(l.key, { quantidade: e.target.value })
                  }
                />
                <Input
                  inputMode="decimal"
                  placeholder={
                    modo === "insumos"
                      ? `Custo un. (R$/${unidade})`
                      : "Custo compra (R$)"
                  }
                  value={l.custo_unitario}
                  onChange={(e) =>
                    updateLinha(l.key, { custo_unitario: e.target.value })
                  }
                />
                <div className="flex items-center justify-end">
                  <IconBtn
                    label="Remover linha"
                    destructive
                    onClick={() => removeLinha(l.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
                {insumo && (
                  <p className="col-span-full -mt-1 text-[11px] text-muted-foreground">
                    Custo atual {formatBRL(insumo.custo_unitario)} · estoque
                    atual: {insumo.saldo_estoque} {insumo.unidade_estoque}
                  </p>
                )}
                {produto && (
                  <p className="col-span-full -mt-1 text-[11px] text-muted-foreground">
                    Custo compra {formatBRL(produto.custo_compra)} · estoque
                    atual: {produto.saldo_estoque} un · sugestão{" "}
                    {formatBRL(produto.preco_ideal_revenda)} ({produto.margem_revenda}%)
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <Field label="Observação">
          <Textarea
            value={observacao}
            rows={2}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: Compra no atacado, sem nota."
          />
        </Field>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <p className="text-xs text-muted-foreground">Valor total</p>
            <p className="font-display text-xl font-bold tabular-nums text-primary">
              {formatBRL(total)}
            </p>
          </div>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar entrada
          </Button>
        </div>
      </div>

      {/* Recent entries */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <FileText className="h-4 w-4 text-muted-foreground" /> Últimas entradas
        </h3>
        {(entradas?.length ?? 0) === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
            Nenhuma entrada registrada.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Doc. nº</th>
                  <th className="px-4 py-2.5 font-semibold">Fornecedor</th>
                  <th className="px-4 py-2.5 font-semibold">Data</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {entradas!.map((e, idx) => (
                  <tr
                    key={e.id}
                    className={idx > 0 ? "border-t border-border" : ""}
                  >
                    <td className="px-4 py-2.5 font-mono font-semibold">
                      #{e.numero_documento_interno}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {e.fornecedor_nome}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-primary">
                      {formatBRL(e.valor_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
