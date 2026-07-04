import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, PackagePlus, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  listInsumos,
  listFornecedores,
  parseNumberInput,
} from "@/lib/erp";
import {
  listContasFinanceiras,
  listEntradasAvulsas,
  registrarEntradaAvulsa,
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

interface LinhaItem {
  key: string;
  id_insumo: string;
  quantidade: string;
  custo_unitario: string;
}

const newLinha = (): LinhaItem => ({
  key: crypto.randomUUID(),
  id_insumo: "",
  quantidade: "",
  custo_unitario: "",
});

export function EntradaEstoqueView() {
  const queryClient = useQueryClient();
  const { data: insumos } = useQuery({
    queryKey: ["erp-insumos"],
    queryFn: listInsumos,
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

  async function handleConfirm() {
    const itens = linhas
      .filter((l) => l.id_insumo && parseNumberInput(l.quantidade) > 0)
      .map((l) => ({
        id_insumo: l.id_insumo,
        quantidade: parseNumberInput(l.quantidade),
        custo_unitario: parseNumberInput(l.custo_unitario),
      }));
    if (itens.length === 0) {
      toast.error("Adicione ao menos um insumo com quantidade.");
      return;
    }
    setSaving(true);
    try {
      const numero = await registrarEntradaAvulsa({
        id_fornecedor: fornecedor === NONE ? null : fornecedor,
        id_conta_financeira: conta === NONE ? null : conta,
        observacao,
        itens,
      });
      toast.success(`Entrada nº ${numero} confirmada!`);
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["entradas-avulsas"] }),
        queryClient.invalidateQueries({ queryKey: ["erp-insumos"] }),
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
            <p className="text-sm font-semibold">Insumos</p>
            <Button size="sm" variant="secondary" onClick={addLinha}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar insumo
            </Button>
          </div>

          {linhas.map((l) => {
            const insumo = insumoById(l.id_insumo);
            return (
              <div
                key={l.key}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-secondary/50 p-2.5 sm:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <Select
                  value={l.id_insumo || undefined}
                  onValueChange={(v) => {
                    const ins = insumoById(v);
                    updateLinha(l.key, {
                      id_insumo: v,
                      custo_unitario:
                        l.custo_unitario ||
                        (ins ? String(ins.custo_unitario).replace(".", ",") : ""),
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {insumos?.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.nome} ({i.unidade_estoque})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="decimal"
                  placeholder={`Qtd. (${insumo?.unidade_estoque ?? "un"})`}
                  value={l.quantidade}
                  onChange={(e) =>
                    updateLinha(l.key, { quantidade: e.target.value })
                  }
                />
                <Input
                  inputMode="decimal"
                  placeholder={`Custo un. (R$/${insumo?.unidade_estoque ?? "un"})`}
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
