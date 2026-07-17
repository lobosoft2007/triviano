import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { fetchClientes, type Cliente } from "@/lib/clientes";
import { formatBRL } from "@/lib/format";
import { composeAddress } from "@/lib/profile";
import { ReportShell } from "@/components/admin/reports/ReportShell";
import type { ReportColumn } from "@/lib/reports/types";

type StatusFilter = "todos" | "ativos" | "bloqueados";
type FiadoFilter = "todos" | "autorizados" | "com_saldo";
type CashbackFilter = "todos" | "com_saldo";
type OrderBy = "nome" | "recente" | "devedor" | "cashback";

const COLUMNS: ReportColumn<Cliente>[] = [
  {
    key: "nome",
    label: "Nome",
    render: (c) => c.full_name || "—",
    minWidth: "160px",
  },
  {
    key: "telefone",
    label: "Telefone",
    render: (c) => c.phone || [c.ddd, c.telefone].filter(Boolean).join(" ") || "—",
  },
  {
    key: "cep",
    label: "CEP",
    render: (c) => c.cep || "—",
    defaultHidden: true,
  },
  {
    key: "endereco",
    label: "Endereço",
    render: (c) => composeAddress(c) || c.address || "—",
    minWidth: "220px",
    defaultHidden: true,
  },
  {
    key: "bairro",
    label: "Bairro",
    render: (c) => c.bairro || "—",
    defaultHidden: true,
  },
  {
    key: "cidade",
    label: "Cidade/UF",
    render: (c) =>
      [c.municipio, c.estado].filter(Boolean).join(" / ") || "—",
  },
  {
    key: "cashback",
    label: "Cashback (R$)",
    render: (c) => formatBRL(c.saldo_cashback),
    numeric: true,
    money: true,
    sum: (c) => c.saldo_cashback,
  },
  {
    key: "devedor",
    label: "Devedor Fiado (R$)",
    render: (c) => formatBRL(c.saldo_devedor_fiado),
    numeric: true,
    money: true,
    sum: (c) => c.saldo_devedor_fiado,
  },
  {
    key: "limite_fiado",
    label: "Limite Fiado (R$)",
    render: (c) => formatBRL(c.limite_fiado),
    numeric: true,
    money: true,
    sum: (c) => c.limite_fiado,
    defaultHidden: true,
  },
  {
    key: "fiado_autorizado",
    label: "Fiado?",
    render: (c) => (c.fiado_autorizado ? "Sim" : "Não"),
    defaultHidden: true,
  },
  {
    key: "bloqueado",
    label: "Bloqueado?",
    render: (c) => (c.bloqueado ? "Sim" : "Não"),
    defaultHidden: true,
  },
  {
    key: "created_at",
    label: "Cadastro",
    render: (c) =>
      c.created_at
        ? new Date(c.created_at).toLocaleDateString("pt-BR")
        : "—",
    defaultHidden: true,
  },
];

const DEFAULT_VISIBLE = COLUMNS.filter((c) => !c.defaultHidden).map((c) => c.key);

function csvValue(row: Cliente, col: ReportColumn<Cliente>): string | number {
  if (col.money && col.sum) return Number(col.sum(row)).toFixed(2);
  const val = col.render(row);
  if (val == null) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  return String(val);
}

export function RelatorioClientes() {
  const { data, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: fetchClientes,
  });

  const [search, setSearch] = useState("");
  const [cidade, setCidade] = useState<string>("todas");
  const [bairro, setBairro] = useState<string>("todos");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [fiado, setFiado] = useState<FiadoFilter>("todos");
  const [cashback, setCashback] = useState<CashbackFilter>("todos");
  const [dtIni, setDtIni] = useState<string>("");
  const [dtFim, setDtFim] = useState<string>("");
  const [orderBy, setOrderBy] = useState<OrderBy>("nome");

  const cidades = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((c) => c.municipio && s.add(c.municipio));
    return Array.from(s).sort();
  }, [data]);

  const bairros = useMemo(() => {
    const s = new Set<string>();
    (data ?? [])
      .filter((c) => cidade === "todas" || c.municipio === cidade)
      .forEach((c) => c.bairro && s.add(c.bairro));
    return Array.from(s).sort();
  }, [data, cidade]);

  const rows = useMemo(() => {
    const list = data ?? [];
    const q = search.trim().toLowerCase();
    const iniMs = dtIni ? new Date(dtIni + "T00:00:00").getTime() : null;
    const fimMs = dtFim ? new Date(dtFim + "T23:59:59").getTime() : null;

    const filtered = list.filter((c) => {
      if (q) {
        const hay = `${c.full_name} ${c.phone} ${c.telefone} ${c.bairro} ${c.municipio}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (cidade !== "todas" && c.municipio !== cidade) return false;
      if (bairro !== "todos" && c.bairro !== bairro) return false;
      if (status === "ativos" && c.bloqueado) return false;
      if (status === "bloqueados" && !c.bloqueado) return false;
      if (fiado === "autorizados" && !c.fiado_autorizado) return false;
      if (fiado === "com_saldo" && c.saldo_devedor_fiado <= 0) return false;
      if (cashback === "com_saldo" && c.saldo_cashback <= 0) return false;
      if (iniMs || fimMs) {
        const t = c.created_at ? new Date(c.created_at).getTime() : 0;
        if (iniMs && t < iniMs) return false;
        if (fimMs && t > fimMs) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (orderBy) {
        case "recente":
          return (b.created_at || "").localeCompare(a.created_at || "");
        case "devedor":
          return b.saldo_devedor_fiado - a.saldo_devedor_fiado;
        case "cashback":
          return b.saldo_cashback - a.saldo_cashback;
        default:
          return (a.full_name || "").localeCompare(b.full_name || "", "pt-BR");
      }
    });
    return sorted;
  }, [data, search, cidade, bairro, status, fiado, cashback, dtIni, dtFim, orderBy]);

  return (
    <ReportShell<Cliente>
      slug="clientes-cadastrados"
      title="Relação de Clientes Cadastrados"
      columns={COLUMNS}
      defaultVisible={DEFAULT_VISIBLE}
      rows={rows}
      loading={isLoading}
      csvValue={csvValue}
      filters={
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="col-span-2 md:col-span-2">
            <Label className="text-[11px] text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, telefone, bairro, cidade…"
                className="h-9 pl-8"
              />
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Cidade</Label>
            <Select
              value={cidade}
              onValueChange={(v) => {
                setCidade(v);
                setBairro("todos");
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {cidades.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Bairro</Label>
            <Select value={bairro} onValueChange={setBairro}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {bairros.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="bloqueados">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Fiado</Label>
            <Select value={fiado} onValueChange={(v) => setFiado(v as FiadoFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="autorizados">Só autorizados</SelectItem>
                <SelectItem value="com_saldo">Só com saldo devedor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Cashback</Label>
            <Select
              value={cashback}
              onValueChange={(v) => setCashback(v as CashbackFilter)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com_saldo">Só com saldo &gt; 0</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Cadastro (de)</Label>
            <Input
              type="date"
              className="h-9"
              value={dtIni}
              onChange={(e) => setDtIni(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Cadastro (até)</Label>
            <Input
              type="date"
              className="h-9"
              value={dtFim}
              onChange={(e) => setDtFim(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Ordenar</Label>
            <Select value={orderBy} onValueChange={(v) => setOrderBy(v as OrderBy)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome (A-Z)</SelectItem>
                <SelectItem value="recente">Cadastro mais recente</SelectItem>
                <SelectItem value="devedor">Maior saldo devedor</SelectItem>
                <SelectItem value="cashback">Maior cashback</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    />
  );
}
