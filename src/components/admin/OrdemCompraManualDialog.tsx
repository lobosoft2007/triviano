import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Printer,
  Search,
  Send,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  listSetores,
  parseNumberInput,
  type Fornecedor,
  type Insumo,
  type Setor,
} from "@/lib/erp";
import {
  criarOrdemCompra,
  type ItemTipo,
  type OrdemCompraItemInput,
} from "@/lib/estoque";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { printReport } from "@/lib/reports/types";
import { shareNodeAsPdfWhatsapp } from "@/lib/pdf-share";
import { empresaAdminConfigQueryOptions } from "@/lib/empresa";
import {
  OrdemCompraReport,
  type OrdemCompraReportRow,
} from "./reports/OrdemCompraReport";

const NONE = "__none__";

interface CatalogItem {
  key: string; // `${tipo}:${id}`
  tipo: ItemTipo;
  ref_id: string;
  nome: string;
  unidade: string;
  setor_id: string | null;
  fornecedor_id: string | null;
  custo_unitario: number;
  saldo_estoque: number;
  estoque_minimo: number;
  estoque_maximo: number;
}

interface FreeItem {
  key: string; // `free:${idx}`
  nome: string;
  setor_id: string | null;
  fornecedor_id: string | null;
  custo_unitario: string;
  quantidade: string;
}

interface RowState {
  quantidade: string;
  custo: string; // allow per-order override
}

interface ProdutoRow {
  id: string;
  name: string;
  setor_id: string | null;
  fornecedor_id: string | null;
  /** Custo de aquisição (o preço `price` é venda e nunca deve ser usado aqui). */
  custo_compra: number;
  saldo_estoque: number;
  estoque_minimo: number;
  estoque_maximo: number;
}

/**
 * Fetches every product that is bought (manipulado = false) with acquisition
 * cost, current stock levels, setor and fornecedor for the manual purchase
 * order grid. `price` (sale price) is intentionally ignored — the cost column
 * must reflect purchase cost only.
 */
async function fetchProdutosRevenda(): Promise<ProdutoRow[]> {
  const { data, error } = await supabase.rpc("admin_get_products", {
    p_only_manipulado_false: true,
  });
  if (error) throw error;
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    setor_id: (p.setor_id as string | null) ?? null,
    fornecedor_id: (p.fornecedor_id as string | null) ?? null,
    custo_compra: Number(p.custo_compra ?? 0),
    saldo_estoque: Number(p.saldo_estoque ?? 0),
    estoque_minimo: Number(p.estoque_minimo ?? 0),
    estoque_maximo: Number(p.estoque_maximo ?? 0),
  }));
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Compact numeric formatter — trims trailing zeros ("12" not "12,00"). */
const fmtNum = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
};

export function OrdemCompraManualDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: setores } = useQuery({
    queryKey: ["erp-setores"],
    queryFn: listSetores,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
  });
  const { data: insumos } = useQuery({
    queryKey: ["erp-insumos"],
    queryFn: listInsumos,
  });
  const { data: produtos } = useQuery({
    queryKey: ["revenda-produtos-full"],
    queryFn: fetchProdutosRevenda,
  });
  const { data: empresa } = useQuery(empresaAdminConfigQueryOptions);

  const setorMap = useMemo(
    () => new Map<string, Setor>((setores ?? []).map((s) => [s.id, s])),
    [setores],
  );
  const fornMap = useMemo(
    () =>
      new Map<string, Fornecedor>(
        (fornecedores ?? []).map((f) => [f.id, f]),
      ),
    [fornecedores],
  );

  /* ---------------- Catalog ----------------------------------------- */
  const catalog: CatalogItem[] = useMemo(() => {
    const rows: CatalogItem[] = [];
    for (const i of insumos ?? []) {
      // Purchasable = any insumo (estocável ou não; se estocável o preenchimento
      // atualiza saldo via ordem; se não estocável ainda pode ser comprado).
      rows.push({
        key: `insumo:${i.id}`,
        tipo: "insumo",
        ref_id: i.id,
        nome: i.nome,
        unidade: i.unidade_medida ?? "un",
        setor_id: i.setor_id,
        fornecedor_id: i.fornecedor_id,
        custo_unitario: Number(i.custo_unitario ?? 0),
        saldo_estoque: Number(i.saldo_estoque ?? 0),
        estoque_minimo: Number(i.estoque_minimo ?? 0),
        estoque_maximo: Number(i.estoque_maximo ?? 0),
      });
    }
    for (const p of produtos ?? []) {
      rows.push({
        key: `produto:${p.id}`,
        tipo: "produto",
        ref_id: p.id,
        nome: p.name,
        unidade: "un",
        setor_id: p.setor_id,
        fornecedor_id: p.fornecedor_id,
        custo_unitario: Number(p.custo_compra ?? 0),
        saldo_estoque: p.saldo_estoque,
        estoque_minimo: p.estoque_minimo,
        estoque_maximo: p.estoque_maximo,
      });
    }
    return rows;
  }, [insumos, produtos]);

  /* ---------------- Interactive state ------------------------------- */
  const [search, setSearch] = useState("");
  const [defaultFornecedor, setDefaultFornecedor] = useState<string>(NONE);
  const [observacao, setObservacao] = useState("");
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [freeItems, setFreeItems] = useState<FreeItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<"print" | "share" | null>(null);

  // Reset when reopening.
  useEffect(() => {
    if (open) {
      setSearch("");
      setDefaultFornecedor(NONE);
      setObservacao("");
      setRowState({});
      setFreeItems([]);
    }
  }, [open]);

  const getRow = (key: string): RowState =>
    rowState[key] ?? { quantidade: "", custo: "" };

  const patchRow = (key: string, patch: Partial<RowState>) =>
    setRowState((s) => ({ ...s, [key]: { ...getRow(key), ...patch } }));

  /* ---------------- Filter + sort ----------------------------------- */
  const filteredCatalog = useMemo(() => {
    const term = normalize(search.trim());
    const rows = term
      ? catalog.filter((r) => normalize(r.nome).includes(term))
      : catalog;

    const sorted = [...rows].sort((a, b) => {
      const sa = setorMap.get(a.setor_id ?? "");
      const sb = setorMap.get(b.setor_id ?? "");
      const oa = sa?.ordem_exibicao ?? 999;
      const ob = sb?.ordem_exibicao ?? 999;
      if (oa !== ob) return oa - ob;
      const na = sa?.setor ?? "";
      const nb = sb?.setor ?? "";
      if (na !== nb) return na.localeCompare(nb);
      const fa = fornMap.get(a.fornecedor_id ?? "")?.fornecedor ?? "";
      const fb = fornMap.get(b.fornecedor_id ?? "")?.fornecedor ?? "";
      if (fa !== fb) return fa.localeCompare(fb);
      return a.nome.localeCompare(b.nome);
    });

    // Group by setor
    const bySetor = new Map<string, CatalogItem[]>();
    for (const r of sorted) {
      const setorKey = r.setor_id ?? "";
      const arr = bySetor.get(setorKey) ?? [];
      arr.push(r);
      bySetor.set(setorKey, arr);
    }
    return Array.from(bySetor.entries()).map(([setorId, items]) => ({
      setorId,
      setorNome: setorMap.get(setorId)?.setor ?? "Sem setor",
      items,
    }));
  }, [catalog, search, setorMap, fornMap]);

  /* ---------------- Totals ------------------------------------------ */
  const selectedRows = useMemo(() => {
    const list: {
      source: CatalogItem;
      qty: number;
      custo: number;
    }[] = [];
    for (const item of catalog) {
      const st = rowState[item.key];
      if (!st) continue;
      const qty = parseNumberInput(st.quantidade);
      if (qty <= 0) continue;
      const custo = st.custo
        ? parseNumberInput(st.custo)
        : item.custo_unitario;
      list.push({ source: item, qty, custo });
    }
    return list;
  }, [catalog, rowState]);

  const totalGeral = useMemo(() => {
    let total = 0;
    for (const r of selectedRows) total += r.qty * r.custo;
    for (const f of freeItems) {
      const q = parseNumberInput(f.quantidade);
      const c = parseNumberInput(f.custo_unitario);
      if (q > 0) total += q * c;
    }
    return total;
  }, [selectedRows, freeItems]);

  const totalItens =
    selectedRows.length +
    freeItems.filter((f) => parseNumberInput(f.quantidade) > 0).length;

  /* ---------------- Report rows for print / PDF --------------------- */
  const reportRows: OrdemCompraReportRow[] = useMemo(() => {
    const rows: OrdemCompraReportRow[] = [];
    for (const r of selectedRows) {
      rows.push({
        nome: r.source.nome,
        tipo: r.source.tipo,
        setor: setorMap.get(r.source.setor_id ?? "")?.setor ?? "",
        fornecedor:
          fornMap.get(r.source.fornecedor_id ?? "")?.fornecedor ??
          (defaultFornecedor !== NONE
            ? fornMap.get(defaultFornecedor)?.fornecedor ?? ""
            : ""),
        unidade: r.source.unidade,
        quantidade: r.qty,
        custo_unitario: r.custo,
      });
    }
    for (const f of freeItems) {
      const q = parseNumberInput(f.quantidade);
      if (q <= 0) continue;
      rows.push({
        nome: f.nome || "(item livre)",
        tipo: "livre",
        setor: setorMap.get(f.setor_id ?? "")?.setor ?? "",
        fornecedor:
          fornMap.get(f.fornecedor_id ?? "")?.fornecedor ??
          (defaultFornecedor !== NONE
            ? fornMap.get(defaultFornecedor)?.fornecedor ?? ""
            : ""),
        unidade: "un",
        quantidade: q,
        custo_unitario: parseNumberInput(f.custo_unitario),
      });
    }
    return rows;
  }, [selectedRows, freeItems, setorMap, fornMap, defaultFornecedor]);

  /* ---------------- Free items -------------------------------------- */
  const addFreeItem = () =>
    setFreeItems((r) => [
      ...r,
      {
        key: `free:${Date.now()}:${r.length}`,
        nome: "",
        setor_id: null,
        fornecedor_id: null,
        custo_unitario: "",
        quantidade: "",
      },
    ]);
  const patchFree = (idx: number, patch: Partial<FreeItem>) =>
    setFreeItems((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removeFree = (idx: number) =>
    setFreeItems((r) => r.filter((_, i) => i !== idx));

  /* ---------------- Save (one order per fornecedor) ----------------- */
  async function handleSave() {
    if (totalItens === 0) {
      toast.error("Adicione ao menos um item com quantidade.");
      return;
    }
    setSaving(true);
    try {
      // Coleta linhas + fornecedor efetivo
      const linhas: { fornId: string | null; input: OrdemCompraItemInput }[] = [];
      for (const r of selectedRows) {
        const fornId =
          r.source.fornecedor_id ??
          (defaultFornecedor !== NONE ? defaultFornecedor : null);
        linhas.push({
          fornId,
          input: {
            tipo: r.source.tipo,
            ref_id: r.source.ref_id,
            nome: r.source.nome,
            quantidade: r.qty,
            custo_unitario: r.custo,
          },
        });
      }
      for (const f of freeItems) {
        const q = parseNumberInput(f.quantidade);
        if (q <= 0 || !f.nome.trim()) continue;
        const fornId =
          f.fornecedor_id ??
          (defaultFornecedor !== NONE ? defaultFornecedor : null);
        linhas.push({
          fornId,
          input: {
            tipo: "insumo",
            ref_id: null,
            nome: f.nome.trim(),
            quantidade: q,
            custo_unitario: parseNumberInput(f.custo_unitario),
          },
        });
      }

      // Agrupa por fornecedor
      const byForn = new Map<string, OrdemCompraItemInput[]>();
      for (const l of linhas) {
        const key = l.fornId ?? "";
        const arr = byForn.get(key) ?? [];
        arr.push(l.input);
        byForn.set(key, arr);
      }

      const numeros: number[] = [];
      for (const [fornId, itens] of byForn) {
        const numero = await criarOrdemCompra({
          id_fornecedor: fornId || null,
          observacao,
          origem: "Manual",
          itens,
        });
        numeros.push(numero);
      }
      toast.success(
        numeros.length === 1
          ? `Ordem de compra nº ${numeros[0]} gerada!`
          : `Ordens geradas: ${numeros.map((n) => `#${n}`).join(", ")}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["ordens-compra"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar ordem.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Print / Share ----------------------------------- */
  const reportRef = useRef<HTMLDivElement>(null);

  async function handlePrint() {
    if (reportRows.length === 0) {
      toast.error("Preencha ao menos um item antes de imprimir.");
      return;
    }
    setBusyAction("print");
    // Give React one tick to render the (already mounted) report with the
    // current data before firing the print dialog.
    setTimeout(() => {
      try {
        printReport("portrait");
      } finally {
        setBusyAction(null);
      }
    }, 50);
  }

  async function handleShare() {
    if (reportRows.length === 0) {
      toast.error("Preencha ao menos um item antes de enviar.");
      return;
    }
    if (!reportRef.current) return;
    setBusyAction("share");
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `ordem-de-compra-${stamp}.pdf`;
      const result = await shareNodeAsPdfWhatsapp(
        reportRef.current,
        filename,
        "portrait",
        "Segue a Ordem de Compra em anexo.",
      );
      toast.success(
        result === "shared"
          ? "PDF pronto para envio."
          : "PDF baixado. Anexe no WhatsApp que abriu em nova aba.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PDF.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          hideClose
          className="flex h-[92dvh] max-h-[92dvh] max-w-5xl flex-col p-0"
        >
          <ModalActionBar
            title="Ordem de Compra Manual / Avulsa"
            onBack={() => onOpenChange(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Gerar ordem"
            saveDisabled={totalItens === 0}
            className="mx-0 mt-0"
          />

          {/* Sticky header — total + filtros + ações */}
          <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Total previsto da ordem
                </p>
                <p className="font-display text-2xl font-bold tabular-nums text-primary">
                  {formatBRL(totalGeral)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {totalItens} item(ns) com quantidade
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={busyAction !== null || totalItens === 0}
                  className="gap-1.5"
                >
                  {busyAction === "print" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Imprimir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  disabled={busyAction !== null || totalItens === 0}
                  className="gap-1.5"
                >
                  {busyAction === "share" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  Enviar PDF por WhatsApp
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_minmax(180px,220px)_minmax(200px,1fr)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar insumo ou produto…"
                />
              </div>
              <Select value={defaultFornecedor} onValueChange={setDefaultFornecedor}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Fornecedor padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Fornecedor padrão…</SelectItem>
                  {fornecedores?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.fornecedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observação (opcional)"
              />
            </div>
          </div>

          {/* Table body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {!setores || !fornecedores || !insumos || !produtos ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead className="sticky top-0 z-[1] bg-secondary/80 text-left text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Item</th>
                    <th className="px-2 py-2 font-semibold">Setor</th>
                    <th className="px-2 py-2 font-semibold">Fornecedor</th>
                    <th className="px-2 py-2 text-right font-semibold">
                      Estoque <span className="font-normal normal-case opacity-70">(mín/máx)</span>
                    </th>
                    <th className="px-2 py-2 text-right font-semibold">Custo un.</th>
                    <th className="px-2 py-2 text-right font-semibold">Quantidade</th>
                    <th className="px-2 py-2 text-right font-semibold">Subtotal</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((group) => (
                    <>
                      <tr key={`sec-${group.setorId}`} className="bg-primary/5">
                        <td
                          colSpan={8}
                          className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary"
                        >
                          {group.setorNome}
                        </td>
                      </tr>
                      {group.items.map((item) => {
                        const st = getRow(item.key);
                        const qty = parseNumberInput(st.quantidade);
                        const custo = st.custo
                          ? parseNumberInput(st.custo)
                          : item.custo_unitario;
                        const subtotal = qty * custo;
                        const abaixoMin =
                          item.estoque_minimo > 0 &&
                          item.saldo_estoque < item.estoque_minimo;
                        return (
                          <tr
                            key={item.key}
                            className={
                              "border-t border-border align-middle " +
                              (qty > 0 ? "bg-amber-50/60 dark:bg-amber-500/10" : "")
                            }
                          >
                            <td className="px-2 py-1.5">
                              <div className="font-medium">{item.nome}</div>
                              <div className="text-[10px] uppercase text-muted-foreground">
                                {item.tipo === "insumo" ? "insumo" : "revenda"} · {item.unidade}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-xs text-muted-foreground">
                              {setorMap.get(item.setor_id ?? "")?.setor ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 text-xs text-muted-foreground">
                              {fornMap.get(item.fornecedor_id ?? "")?.fornecedor ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right text-xs tabular-nums">
                              <span
                                className={
                                  abaixoMin
                                    ? "font-semibold text-destructive"
                                    : "text-foreground"
                                }
                              >
                                {fmtNum(item.saldo_estoque)}
                              </span>
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                ({fmtNum(item.estoque_minimo)}/{fmtNum(item.estoque_maximo)})
                              </span>
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                className="ml-auto h-8 w-24 text-right"
                                inputMode="decimal"
                                value={st.custo}
                                placeholder={String(item.custo_unitario).replace(".", ",")}
                                onChange={(e) => patchRow(item.key, { custo: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                className="ml-auto h-8 w-24 text-right"
                                inputMode="decimal"
                                value={st.quantidade}
                                onChange={(e) =>
                                  patchRow(item.key, { quantidade: e.target.value })
                                }
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                              {subtotal > 0 ? formatBRL(subtotal) : "—"}
                            </td>
                            <td />
                          </tr>
                        );
                      })}
                    </>
                  ))}

                  {filteredCatalog.length === 0 && search && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum item encontrado para "{search}".
                      </td>
                    </tr>
                  )}

                  {/* Itens livres */}
                  {freeItems.length > 0 && (
                    <tr className="bg-primary/5">
                      <td
                        colSpan={8}
                        className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary"
                      >
                        Itens livres
                      </td>
                    </tr>
                  )}
                  {freeItems.map((f, idx) => {
                    const q = parseNumberInput(f.quantidade);
                    const c = parseNumberInput(f.custo_unitario);
                    return (
                      <tr
                        key={f.key}
                        className={
                          "border-t border-border align-middle " +
                          (q > 0 ? "bg-amber-50/60 dark:bg-amber-500/10" : "")
                        }
                      >
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8"
                            value={f.nome}
                            onChange={(e) => patchFree(idx, { nome: e.target.value })}
                            placeholder="Nome do item livre"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select
                            value={f.setor_id ?? NONE}
                            onValueChange={(v) =>
                              patchFree(idx, { setor_id: v === NONE ? null : v })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Sem setor</SelectItem>
                              {setores?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.setor}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Select
                            value={f.fornecedor_id ?? NONE}
                            onValueChange={(v) =>
                              patchFree(idx, { fornecedor_id: v === NONE ? null : v })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Sem fornecedor</SelectItem>
                              {fornecedores?.map((forn) => (
                                <SelectItem key={forn.id} value={forn.id}>
                                  {forn.fornecedor}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">—</td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="ml-auto h-8 w-24 text-right"
                            inputMode="decimal"
                            value={f.custo_unitario}
                            onChange={(e) =>
                              patchFree(idx, { custo_unitario: e.target.value })
                            }
                            placeholder="0,00"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="ml-auto h-8 w-24 text-right"
                            inputMode="decimal"
                            value={f.quantidade}
                            onChange={(e) =>
                              patchFree(idx, { quantidade: e.target.value })
                            }
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                          {q > 0 ? formatBRL(q * c) : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            aria-label="Remover"
                            onClick={() => removeFree(idx)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="mt-3 flex justify-start">
              <Button
                variant="secondary"
                size="sm"
                onClick={addFreeItem}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> Adicionar item livre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Off-screen A4 report used by print / PDF share. Kept in the DOM so
          the print CSS in styles.css picks up `.report-a4` even when the
          dialog owns the visible layout. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: "210mm",
          pointerEvents: "none",
        }}
      >
        <OrdemCompraReport
          ref={reportRef}
          empresa={empresa}
          rows={reportRows}
          observacao={observacao}
        />
      </div>

      {/* Silence unused-icon lint if the icon becomes optional in the future. */}
      <Send className="hidden" />
    </>
  );
}
