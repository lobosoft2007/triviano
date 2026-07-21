import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageCheck, FileText, X } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

import {
  listFornecedores,
  listInsumos,
  listRevendaProdutos,
  parseNumberInput,
} from "@/lib/erp";
import { listContasFinanceiras } from "@/lib/tesouraria";
import {
  getOrdemCompra,
  type OrdemCompraDetalhe,
  type OrdemCompraItem,
} from "@/lib/estoque";
import {
  encerrarOrdemCompra,
  listRecebimentosOrdem,
  receberOrdemCompra,
} from "@/lib/recebimentos";
import { formatBRL } from "@/lib/format";

const NONE = "__none__";

interface Linha {
  key: string;
  id_item_ordem: string | null;
  tipo: OrdemCompraItem["tipo"];
  ref_id: string | null;
  nome: string;
  unidade: string;
  quantidade_pedida: number;
  custo_pedido: number;
  quantidade: string;
  custo: string;
  receber: boolean;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function RecebimentoOrdemDialog({
  ordemId,
  open,
  onOpenChange,
}: {
  ordemId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const enabled = open && !!ordemId;

  const { data: ordem, isLoading } = useQuery({
    queryKey: ["ordem-compra", ordemId],
    queryFn: () => getOrdemCompra(ordemId!),
    enabled,
  });

  const { data: recebimentos } = useQuery({
    queryKey: ["recebimentos-ordem", ordemId],
    queryFn: () => listRecebimentosOrdem(ordemId!),
    enabled,
  });

  const { data: insumos } = useQuery({
    queryKey: ["erp-insumos"],
    queryFn: listInsumos,
    enabled,
  });
  const { data: produtos } = useQuery({
    queryKey: ["erp-produtos-revenda"],
    queryFn: listRevendaProdutos,
    enabled,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
    enabled,
  });
  const { data: contas } = useQuery({
    queryKey: ["tesouraria-contas"],
    queryFn: listContasFinanceiras,
    enabled,
  });

  const insumoById = useMemo(
    () => new Map((insumos ?? []).map((i) => [i.id, i])),
    [insumos],
  );
  const produtoById = useMemo(
    () => new Map((produtos ?? []).map((p) => [p.id, p])),
    [produtos],
  );
  const contasFisicas = useMemo(
    () =>
      (contas ?? []).filter(
        (c) => c.ativo && c.tipo_conta !== "Recebível_Futuro",
      ),
    [contas],
  );

  // Já recebido acumulado por id_item_ordem
  const jaRecebidoPorItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recebimentos ?? []) {
      for (const it of r.itens) {
        // Não temos id_item_ordem em RecebimentoItem, mas podemos casar por ref_id+tipo
        const key = `${it.tipo}:${it.ref_id ?? "livre"}:${it.nome}`;
        m.set(key, (m.get(key) ?? 0) + Number(it.quantidade_recebida ?? 0));
      }
    }
    return m;
  }, [recebimentos]);

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [comNF, setComNF] = useState(false);
  const [numeroNF, setNumeroNF] = useState("");
  const [serieNF, setSerieNF] = useState("");
  const [chaveAcesso, setChaveAcesso] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataEntrada, setDataEntrada] = useState(hojeISO());
  const [fornecedor, setFornecedor] = useState<string>(NONE);
  const [conta, setConta] = useState<string>(NONE);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  useEffect(() => {
    if (!ordem) return;
    setLinhas(
      ordem.itens.map((i) => {
        const key = `${i.tipo}:${i.ref_id ?? "livre"}:${i.nome}`;
        const jaRec = jaRecebidoPorItem.get(key) ?? 0;
        const restante = Math.max(0, Number(i.quantidade) - jaRec);
        return {
          key: i.id,
          id_item_ordem: i.id,
          tipo: i.tipo,
          ref_id: i.ref_id,
          nome: i.nome,
          unidade: i.unidade ?? "un",
          quantidade_pedida: Number(i.quantidade),
          custo_pedido: Number(i.custo_unitario),
          quantidade: restante > 0 ? String(restante).replace(".", ",") : "",
          custo: String(i.custo_unitario).replace(".", ","),
          receber: restante > 0,
        };
      }),
    );
    setFornecedor(ordem.id_fornecedor ?? NONE);
    setObservacao("");
    setNumeroNF("");
    setSerieNF("");
    setChaveAcesso("");
    setDataEmissao("");
    setDataEntrada(hojeISO());
    setComNF(false);
    setConta(NONE);
  }, [ordem, jaRecebidoPorItem]);

  const patch = (key: string, p: Partial<Linha>) =>
    setLinhas((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const total = useMemo(
    () =>
      linhas.reduce((sum, l) => {
        if (!l.receber) return sum;
        return sum + parseNumberInput(l.quantidade) * parseNumberInput(l.custo);
      }, 0),
    [linhas],
  );

  async function handleConfirmar() {
    if (!ordem) return;
    const itens = linhas
      .filter((l) => l.receber && parseNumberInput(l.quantidade) > 0)
      .map((l) => ({
        id_item_ordem: l.id_item_ordem,
        tipo: l.tipo,
        ref_id: l.ref_id,
        nome: l.nome,
        quantidade: parseNumberInput(l.quantidade),
        custo_unitario: parseNumberInput(l.custo),
      }));
    if (itens.length === 0) {
      toast.error("Marque ao menos um item com quantidade > 0.");
      return;
    }
    if (comNF && !numeroNF.trim()) {
      toast.error("Informe o número da NF.");
      return;
    }
    if (comNF && chaveAcesso && chaveAcesso.replace(/\D/g, "").length !== 44) {
      toast.error("Chave de acesso deve ter 44 dígitos.");
      return;
    }

    setSaving(true);
    try {
      const numero = await receberOrdemCompra({
        ordem_id: ordem.id,
        cabecalho: {
          com_nf: comNF,
          numero_nf: comNF ? numeroNF.trim() : null,
          serie_nf: comNF ? serieNF.trim() || null : null,
          chave_acesso: comNF ? chaveAcesso.replace(/\D/g, "") || null : null,
          data_emissao: comNF ? dataEmissao || null : null,
          data_entrada: dataEntrada || hojeISO(),
          id_fornecedor: fornecedor === NONE ? null : fornecedor,
          id_conta_financeira: conta === NONE ? null : conta,
          observacao: observacao.trim(),
        },
        itens,
      });
      toast.success(`Recebimento nº ${numero} registrado!`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ordens-compra"] }),
        queryClient.invalidateQueries({ queryKey: ["ordem-compra", ordem.id] }),
        queryClient.invalidateQueries({ queryKey: ["recebimentos-ordem", ordem.id] }),
        queryClient.invalidateQueries({ queryKey: ["erp-insumos"] }),
        queryClient.invalidateQueries({ queryKey: ["erp-produtos-revenda"] }),
        queryClient.invalidateQueries({ queryKey: ["tesouraria-contas"] }),
        queryClient.invalidateQueries({ queryKey: ["tesouraria-painel"] }),
      ]);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar recebimento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEncerrar() {
    if (!ordem) return;
    if (!confirm(`Encerrar a Ordem nº ${ordem.numero}? Não será possível receber mais itens.`))
      return;
    setEncerrando(true);
    try {
      await encerrarOrdemCompra(ordem.id);
      toast.success("Ordem encerrada.");
      await queryClient.invalidateQueries({ queryKey: ["ordens-compra"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao encerrar.");
    } finally {
      setEncerrando(false);
    }
  }

  const canReceive = (ordem?.status ?? "Aberta") !== "Recebida";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="flex h-[92dvh] max-h-[92dvh] max-w-4xl flex-col p-0"
      >
        <ModalActionBar
          title={
            ordem
              ? `Receber Mercadoria · Ordem nº ${ordem.numero}`
              : "Receber Mercadoria"
          }
          onBack={() => onOpenChange(false)}
          onSave={canReceive ? handleConfirmar : undefined}
          saving={saving}
          saveLabel="Confirmar recebimento"
          saveDisabled={!canReceive || total <= 0}
          className="mx-0 mt-0"
        />

        {isLoading || !ordem ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Cabeçalho */}
            <div className="space-y-3 border-b border-border bg-secondary/30 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <PackageCheck className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold">Dados do recebimento</p>
                <div className="ml-auto flex items-center gap-2">
                  <Label htmlFor="com-nf" className="text-sm">Com NF</Label>
                  <Switch id="com-nf" checked={comNF} onCheckedChange={setComNF} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="col-span-2 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                  <Select value={fornecedor} onValueChange={setFornecedor}>
                    <SelectTrigger className="h-9">
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
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data entrada</Label>
                  <Input
                    type="date"
                    value={dataEntrada}
                    onChange={(e) => setDataEntrada(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pagar com</Label>
                  <Select value={conta} onValueChange={setConta}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Não lançar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Não lançar</SelectItem>
                      {contasFisicas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {comNF && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nº NF *</Label>
                    <Input
                      value={numeroNF}
                      onChange={(e) => setNumeroNF(e.target.value)}
                      className="h-9"
                      placeholder="000000"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Série</Label>
                    <Input
                      value={serieNF}
                      onChange={(e) => setSerieNF(e.target.value)}
                      className="h-9"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data emissão</Label>
                    <Input
                      type="date"
                      value={dataEmissao}
                      onChange={(e) => setDataEmissao(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <Label className="text-xs text-muted-foreground">
                      Chave de acesso (44 dígitos, opcional)
                    </Label>
                    <Input
                      value={chaveAcesso}
                      onChange={(e) => setChaveAcesso(e.target.value)}
                      className="h-9 font-mono text-xs"
                      placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Observação</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  placeholder={comNF ? "Ex.: divergência de preço no item X" : "Ex.: compra em atacado, sem nota"}
                />
              </div>
            </div>

            {/* Itens a receber */}
            <div className="px-4 py-3">
              <p className="mb-2 text-sm font-semibold">Itens do pedido</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-secondary/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-10 px-2 py-2">Rec.</th>
                      <th className="px-2 py-2 font-semibold">Item</th>
                      <th className="px-2 py-2 text-right font-semibold">Pedido</th>
                      <th className="px-2 py-2 text-right font-semibold">Qtd. recebida</th>
                      <th className="px-2 py-2 text-right font-semibold">Custo pago</th>
                      <th className="px-2 py-2 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => {
                      const q = parseNumberInput(l.quantidade);
                      const c = parseNumberInput(l.custo);
                      const insumo = l.tipo === "insumo" && l.ref_id ? insumoById.get(l.ref_id) : undefined;
                      const produto = l.tipo === "produto" && l.ref_id ? produtoById.get(l.ref_id) : undefined;
                      const custoAtual = insumo?.custo_unitario ?? produto?.custo_compra;
                      const saldoAtual = insumo?.saldo_estoque ?? produto?.saldo_estoque;
                      return (
                        <tr key={l.key} className="border-t border-border align-top">
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={l.receber}
                              onChange={(e) => patch(l.key, { receber: e.target.checked })}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="font-medium">{l.nome}</div>
                            <div className="text-[10px] uppercase text-muted-foreground">
                              {l.tipo}
                              {custoAtual !== undefined && (
                                <> · custo atual {formatBRL(custoAtual)}</>
                              )}
                              {saldoAtual !== undefined && (
                                <> · saldo {saldoAtual} {l.unidade}</>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                            {l.quantidade_pedida} {l.unidade}
                            <div className="text-[10px]">{formatBRL(l.custo_pedido)}</div>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              inputMode="decimal"
                              value={l.quantidade}
                              disabled={!l.receber}
                              onChange={(e) => patch(l.key, { quantidade: e.target.value })}
                              className="ml-auto h-8 w-24 text-right"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              inputMode="decimal"
                              value={l.custo}
                              disabled={!l.receber}
                              onChange={(e) => patch(l.key, { custo: e.target.value })}
                              className="ml-auto h-8 w-24 text-right"
                            />
                          </td>
                          <td className="px-2 py-2 text-right font-semibold tabular-nums">
                            {l.receber && q > 0 ? formatBRL(q * c) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {linhas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                          Ordem sem itens.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/40">
                      <td colSpan={5} className="px-2 py-2 text-right text-sm font-semibold">
                        Total do recebimento
                      </td>
                      <td className="px-2 py-2 text-right font-display text-lg font-bold tabular-nums text-primary">
                        {formatBRL(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Histórico */}
            {(recebimentos?.length ?? 0) > 0 && (
              <div className="border-t border-border px-4 py-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Recebimentos anteriores
                </p>
                <div className="space-y-2">
                  {recebimentos!.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-border bg-card p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold">Rec. nº {r.numero}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString("pt-BR")}
                          </span>
                          {r.com_nf && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                              NF {r.numero_nf}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold tabular-nums text-primary">
                          {formatBRL(r.valor_total)}
                        </span>
                      </div>
                      {r.observacao && (
                        <p className="mt-1 text-xs text-muted-foreground">{r.observacao}</p>
                      )}
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {r.itens.map((i) => (
                          <li key={i.id}>
                            {i.quantidade_recebida} × {i.nome} @ {formatBRL(i.custo_unitario_pago)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {canReceive && (ordem?.status ?? "") === "Parcial" && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleEncerrar}
                      disabled={encerrando}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {encerrando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Encerrar ordem sem receber o restante
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Re-export detalhe type to keep imports local if consumers need it.
export type { OrdemCompraDetalhe };
