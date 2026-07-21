import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

import { formatBRL } from "@/lib/format";
import { ReportShell } from "@/components/admin/reports/ReportShell";
import type { ReportColumn } from "@/lib/reports/types";

/**
 * Linha padronizada de uma Ordem de Compra para o relatório A4.
 * `setor` e `fornecedor` devem vir já resolvidos (nomes), para que o
 * relatório não dependa de mapas assíncronos do caller.
 */
export interface OrdemCompraLinha {
  nome: string;
  tipo: "insumo" | "produto" | "livre";
  setor: string;
  fornecedor: string;
  unidade: string;
  quantidade: number;
  custo_unitario: number;
  estoque_atual?: number | null;
  estoque_minimo?: number | null;
  estoque_maximo?: number | null;
}

type OrderBy =
  | "setor_forn_nome"
  | "forn_nome"
  | "nome"
  | "maior_subtotal";

const COLUMNS: ReportColumn<OrdemCompraLinha>[] = [
  {
    key: "nome",
    label: "Item",
    render: (r) => r.nome || "—",
    minWidth: "180px",
  },
  {
    key: "setor",
    label: "Setor",
    render: (r) => r.setor || "—",
  },
  {
    key: "fornecedor",
    label: "Fornecedor",
    render: (r) => r.fornecedor || "—",
  },
  {
    key: "unidade",
    label: "Un.",
    render: (r) => r.unidade || "un",
  },
  {
    key: "quantidade",
    label: "Qtd",
    render: (r) =>
      new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
        r.quantidade,
      ),
    numeric: true,
  },
  {
    key: "custo_unitario",
    label: "Custo un. (R$)",
    render: (r) => formatBRL(r.custo_unitario),
    numeric: true,
    money: true,
    sum: (r) => r.custo_unitario,
  },
  {
    key: "subtotal",
    label: "Subtotal (R$)",
    render: (r) => formatBRL(r.quantidade * r.custo_unitario),
    numeric: true,
    money: true,
    sum: (r) => r.quantidade * r.custo_unitario,
  },
  {
    key: "estoque_atual",
    label: "Estoque atual",
    render: (r) =>
      r.estoque_atual == null
        ? "—"
        : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
            r.estoque_atual,
          ),
    numeric: true,
    defaultHidden: true,
  },
  {
    key: "minmax",
    label: "Mín / Máx",
    render: (r) =>
      r.estoque_minimo == null && r.estoque_maximo == null
        ? "—"
        : `${r.estoque_minimo ?? 0} / ${r.estoque_maximo ?? 0}`,
    numeric: true,
    defaultHidden: true,
  },
  {
    key: "tipo",
    label: "Tipo",
    render: (r) => r.tipo,
    defaultHidden: true,
  },
];

const DEFAULT_VISIBLE = COLUMNS.filter((c) => !c.defaultHidden).map((c) => c.key);

function csvValue(
  row: OrdemCompraLinha,
  col: ReportColumn<OrdemCompraLinha>,
): string | number {
  if (col.money && col.sum) return Number(col.sum(row)).toFixed(2);
  const val = col.render(row);
  if (val == null) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  return String(val);
}

interface RelatorioOrdemCompraProps {
  slug?: string;
  title: string;
  rows: OrdemCompraLinha[];
  observacao?: string;
  loading?: boolean;
}

export function RelatorioOrdemCompra({
  slug = "ordem-de-compra",
  title,
  rows,
  observacao,
  loading,
}: RelatorioOrdemCompraProps) {
  const [search, setSearch] = useState("");
  const [setor, setSetor] = useState<string>("todos");
  const [fornecedor, setFornecedor] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [orderBy, setOrderBy] = useState<OrderBy>("setor_forn_nome");

  const setores = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.setor && s.add(r.setor));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const fornecedores = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.fornecedor && s.add(r.fornecedor));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (q) {
        const hay = `${r.nome} ${r.setor} ${r.fornecedor}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (setor !== "todos" && r.setor !== setor) return false;
      if (fornecedor !== "todos" && r.fornecedor !== fornecedor) return false;
      if (tipo !== "todos" && r.tipo !== tipo) return false;
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (orderBy) {
        case "forn_nome": {
          const cmp = (a.fornecedor || "zzz").localeCompare(
            b.fornecedor || "zzz",
            "pt-BR",
          );
          return cmp !== 0 ? cmp : a.nome.localeCompare(b.nome, "pt-BR");
        }
        case "nome":
          return a.nome.localeCompare(b.nome, "pt-BR");
        case "maior_subtotal":
          return b.quantidade * b.custo_unitario - a.quantidade * a.custo_unitario;
        case "setor_forn_nome":
        default: {
          const s1 = (a.setor || "zzz").localeCompare(b.setor || "zzz", "pt-BR");
          if (s1 !== 0) return s1;
          const f = (a.fornecedor || "zzz").localeCompare(
            b.fornecedor || "zzz",
            "pt-BR",
          );
          if (f !== 0) return f;
          return a.nome.localeCompare(b.nome, "pt-BR");
        }
      }
    });
    return sorted;
  }, [rows, search, setor, fornecedor, tipo, orderBy]);

  return (
    <div className="space-y-3">
      {observacao ? (
        <p className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground print:hidden">
          <b>Observação:</b> {observacao}
        </p>
      ) : null}

      <ReportShell<OrdemCompraLinha>
        slug={slug}
        title={title}
        columns={COLUMNS}
        defaultVisible={DEFAULT_VISIBLE}
        rows={filtered}
        loading={loading}
        csvValue={csvValue}
        filters={
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <div className="col-span-2">
              <Label className="text-[11px] text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Item, setor, fornecedor…"
                  className="h-9 pl-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground">Setor</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {setores.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground">
                Fornecedor
              </Label>
              <Select value={fornecedor} onValueChange={setFornecedor}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="insumo">Insumo</SelectItem>
                  <SelectItem value="produto">Revenda</SelectItem>
                  <SelectItem value="livre">Livre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 md:col-span-2">
              <Label className="text-[11px] text-muted-foreground">Ordenar</Label>
              <Select value={orderBy} onValueChange={(v) => setOrderBy(v as OrderBy)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setor_forn_nome">
                    Setor → Fornecedor → Nome
                  </SelectItem>
                  <SelectItem value="forn_nome">Fornecedor → Nome</SelectItem>
                  <SelectItem value="nome">Nome (A-Z)</SelectItem>
                  <SelectItem value="maior_subtotal">Maior subtotal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />
    </div>
  );
}

interface RelatorioOrdemCompraDialogProps extends RelatorioOrdemCompraProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Diálogo em tela cheia que hospeda o relatório A4 padronizado. */
export function RelatorioOrdemCompraDialog({
  open,
  onOpenChange,
  ...props
}: RelatorioOrdemCompraDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="flex h-[95dvh] max-h-[95dvh] max-w-[1200px] flex-col gap-0 p-0"
      >
        <ModalActionBar
          title={props.title}
          onBack={() => onOpenChange(false)}
          className="mx-0 mt-0 print:hidden"
        />
        <div className="min-h-0 flex-1 overflow-y-auto bg-secondary/30 p-4 print:block print:bg-white print:p-0">
          <RelatorioOrdemCompra {...props} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
