import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Loader2,
  ShoppingCart,
  Plus,
  Wallet,
  AlertTriangle,
  FileText,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import {
  fetchPatrimonioEstoque,
  fetchSugestaoCompras,
  criarOrdemCompra,
  listOrdensCompra,
  type SugestaoItem,
  type OrdemCompraItemInput,
} from "@/lib/estoque";
import {
  listSetores,
  listFornecedores,
} from "@/lib/erp";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrdemCompraManualDialog, type PreloadedOCItem } from "./OrdemCompraManualDialog";
import { OrdemCompraDetailDialog } from "./OrdemCompraDetailDialog";

const NONE = "__none__";


export function SugestaoComprasView() {
  const queryClient = useQueryClient();

  const { data: patrimonio } = useQuery({
    queryKey: ["patrimonio-estoque"],
    queryFn: fetchPatrimonioEstoque,
  });
  const { data: sugestao, isLoading } = useQuery({
    queryKey: ["sugestao-compras"],
    queryFn: fetchSugestaoCompras,
  });
  const { data: setores } = useQuery({
    queryKey: ["erp-setores"],
    queryFn: listSetores,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
  });
  const { data: ordens } = useQuery({
    queryKey: ["ordens-compra"],
    queryFn: () => listOrdensCompra(20),
  });

  // Realtime: recalcula patrimônio e sugestão quando o estoque muda.
  useEffect(() => {
    const channel = supabase
      .channel("estoque-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insumos" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["patrimonio-estoque"] });
          queryClient.invalidateQueries({ queryKey: ["sugestao-compras"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["patrimonio-estoque"] });
          queryClient.invalidateQueries({ queryKey: ["sugestao-compras"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const fornMap = useMemo(
    () => new Map((fornecedores ?? []).map((f) => [f.id, f.fornecedor])),
    [fornecedores],
  );
  const setorMap = useMemo(
    () => new Map((setores ?? []).map((s) => [s.id, s.setor])),
    [setores],
  );
  const setorOrdem = useMemo(
    () => new Map((setores ?? []).map((s) => [s.id, s.ordem_exibicao])),
    [setores],
  );

  // Agrupa por fornecedor, e dentro do fornecedor organiza por setor.
  const grupos = useMemo(() => {
    const byForn = new Map<string, SugestaoItem[]>();
    for (const item of sugestao ?? []) {
      const key = item.fornecedor_id ?? NONE;
      const arr = byForn.get(key) ?? [];
      arr.push(item);
      byForn.set(key, arr);
    }
    return Array.from(byForn.entries())
      .map(([fornId, itens]) => {
        itens.sort((a, b) => {
          const oa = setorOrdem.get(a.setor_id ?? "") ?? 999;
          const ob = setorOrdem.get(b.setor_id ?? "") ?? 999;
          if (oa !== ob) return oa - ob;
          return a.nome.localeCompare(b.nome);
        });
        const total = itens.reduce(
          (s, i) => s + i.quantidade_comprar * i.custo_unitario,
          0,
        );
        return {
          fornId: fornId === NONE ? null : fornId,
          fornNome: fornId === NONE ? "Sem fornecedor" : fornMap.get(fornId) ?? "—",
          itens,
          total,
        };
      })
      .sort((a, b) => a.fornNome.localeCompare(b.fornNome));
  }, [sugestao, fornMap, setorOrdem]);

  const totalGeral = useMemo(
    () =>
      (sugestao ?? []).reduce(
        (s, i) => s + i.quantidade_comprar * i.custo_unitario,
        0,
      ),
    [sugestao],
  );

  /* ---------------- Gerar ordem a partir de um grupo sugerido -------- */
  async function gerarOrdemGrupo(grupo: {
    fornId: string | null;
    fornNome: string;
    itens: SugestaoItem[];
  }) {
    try {
      const itens: OrdemCompraItemInput[] = grupo.itens.map((i) => ({
        tipo: i.tipo,
        ref_id: i.ref_id,
        nome: i.nome,
        quantidade: i.quantidade_comprar,
        custo_unitario: i.custo_unitario,
      }));
      const numero = await criarOrdemCompra({
        id_fornecedor: grupo.fornId,
        observacao: `Reposição automática (${grupo.fornNome})`,
        origem: "Sugestão",
        itens,
      });
      toast.success(`Ordem de compra nº ${numero} gerada!`);
      await queryClient.invalidateQueries({ queryKey: ["ordens-compra"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar ordem.");
    }
  }

  /* ---------------- Gerar UMA ordem consolidada (todos fornecedores) ---- */
  async function gerarOrdemUnica() {
    if (!sugestao || sugestao.length === 0) {
      toast.error("Nada a comprar no momento.");
      return;
    }
    if (
      !confirm(
        `Gerar UMA única ordem com ${sugestao.length} item(ns), somando todos os fornecedores?`,
      )
    )
      return;
    try {
      const itens: OrdemCompraItemInput[] = sugestao.map((i) => ({
        tipo: i.tipo,
        ref_id: i.ref_id,
        nome: i.nome,
        quantidade: i.quantidade_comprar,
        custo_unitario: i.custo_unitario,
      }));
      const numero = await criarOrdemCompra({
        id_fornecedor: null,
        observacao: "Reposição automática — consolidada (todos fornecedores)",
        origem: "Sugestão",
        itens,
      });
      toast.success(`Ordem única nº ${numero} gerada!`);
      await queryClient.invalidateQueries({ queryKey: ["ordens-compra"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar ordem.");
    }
  }


  /* ---------------- Manual order dialog ----------------------------- */
  const [open, setOpen] = useState(false);
  const [consolidatedOpen, setConsolidatedOpen] = useState(false);
  const [preloaded, setPreloaded] = useState<PreloadedOCItem[]>([]);
  const openManual = () => setOpen(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  function abrirConsolidadaPorSetor() {
    if (!sugestao || sugestao.length === 0) {
      toast.error("Nada a comprar no momento.");
      return;
    }
    const items: PreloadedOCItem[] = sugestao.map((i) => ({
      tipo: i.tipo,
      ref_id: i.ref_id,
      nome: i.nome,
      unidade: i.unidade,
      setor_id: i.setor_id,
      fornecedor_id: i.fornecedor_id,
      custo_unitario: i.custo_unitario,
      quantidade: i.quantidade_comprar,
    }));
    items.sort((a, b) => {
      const oa = setorOrdem.get(a.setor_id ?? "") ?? 999;
      const ob = setorOrdem.get(b.setor_id ?? "") ?? 999;
      if (oa !== ob) return oa - ob;
      const fa = fornMap.get(a.fornecedor_id ?? "") ?? "zzz";
      const fb = fornMap.get(b.fornecedor_id ?? "") ?? "zzz";
      if (fa !== fb) return fa.localeCompare(fb);
      return a.nome.localeCompare(b.nome);
    });
    setPreloaded(items);
    setConsolidatedOpen(true);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">
            Sugestão de Compras por Demanda
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={gerarOrdemUnica}
          >
            <Send className="mr-1 h-4 w-4" /> Gerar Ordem Única (todos fornecedores)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={abrirConsolidadaPorSetor}
          >
            <Send className="mr-1 h-4 w-4" /> Gerar Ordem Consolidada por Setor
          </Button>
          <Button size="sm" onClick={openManual}>
            <Plus className="mr-1 h-4 w-4" /> Gerar Ordem de Compra Manual / Avulsa
          </Button>
        </div>
      </header>


      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Patrimônio Líquido em Estoque
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-primary">
            {formatBRL(patrimonio ?? 0)}
          </p>
          <p className="text-[11px] text-muted-foreground">Atualizado em tempo real</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Itens abaixo do mínimo
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {sugestao?.length ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShoppingCart className="h-3.5 w-3.5" /> Custo total sugerido
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">
            {formatBRL(totalGeral)}
          </p>
        </div>
      </div>

      {/* Lista agrupada por fornecedor / setor */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : grupos.length === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhum item abaixo do estoque mínimo. Cadastre estoque mínimo/máximo nos
          insumos e produtos de revenda para ativar a sugestão automática.
        </p>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div
              key={g.fornId ?? "none"}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
                <div>
                  <p className="text-sm font-bold">{g.fornNome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {g.itens.length} item(ns) · {formatBRL(g.total)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => gerarOrdemGrupo(g)}
                >
                  <Send className="mr-1 h-4 w-4" /> Gerar ordem
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Item</th>
                      <th className="px-4 py-2 font-semibold">Setor</th>
                      <th className="px-4 py-2 text-right font-semibold">Atual</th>
                      <th className="px-4 py-2 text-right font-semibold">Mín</th>
                      <th className="px-4 py-2 text-right font-semibold">Máx</th>
                      <th className="px-4 py-2 text-right font-semibold">Comprar</th>
                      <th className="px-4 py-2 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.itens.map((i) => (
                      <tr key={`${i.tipo}-${i.ref_id}`} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">
                          {i.nome}
                          <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {i.tipo === "insumo" ? "insumo" : "revenda"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {setorMap.get(i.setor_id ?? "") ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-destructive">
                          {i.estoque_atual}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {i.estoque_minimo}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {i.estoque_maximo}
                        </td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums text-primary">
                          {i.quantidade_comprar} {i.unidade}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">
                          {formatBRL(i.quantidade_comprar * i.custo_unitario)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ordens recentes */}
      <div>
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
          <FileText className="h-4 w-4 text-primary" /> Ordens de compra recentes
        </h3>
        {(ordens?.length ?? 0) === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
            Nenhuma ordem gerada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Nº</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Fornecedor</th>
                  <th className="px-4 py-2.5 font-semibold">Origem</th>
                  <th className="px-4 py-2.5 font-semibold">Data</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordens!.map((o, idx) => (
                  <tr key={o.id} className={idx > 0 ? "border-t border-border" : ""}>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">#{o.numero}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                          (o.status === "Aberta"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300")
                        }
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{o.fornecedor_nome}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{o.origem}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-primary">
                      {formatBRL(o.valor_total)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetailId(o.id)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" /> Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual order dialog (novo formato, buscável + impressão/PDF) */}
      <OrdemCompraManualDialog open={open} onOpenChange={setOpen} />

      {/* Detalhe / edição / impressão / WhatsApp / exclusão */}
      <OrdemCompraDetailDialog
        ordemId={detailId}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      />


    </section>
  );
}
