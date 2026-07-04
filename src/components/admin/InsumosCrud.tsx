import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  listInsumos,
  saveInsumo,
  deleteInsumo,
  listSetores,
  listFornecedores,
  parseNumberInput,
  type Insumo,
} from "@/lib/erp";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import { IconBtn } from "./SetoresCrud";
import { Field } from "./FornecedoresCrud";

const NONE = "__none__";

interface FormState {
  id: string | null;
  nome: string;
  unidade_medida: string;
  unidade_estoque: string;
  fator_conversao: string;
  controlado: boolean;
  custo_unitario: string;
  estocavel: boolean;
  fornecedor_id: string;
  setor_id: string;
  estoque_minimo: string;
  estoque_maximo: string;
}

const EMPTY: FormState = {
  id: null,
  nome: "",
  unidade_medida: "un",
  unidade_estoque: "un",
  fator_conversao: "1",
  controlado: false,
  custo_unitario: "",
  estocavel: true,
  fornecedor_id: NONE,
  setor_id: NONE,
  estoque_minimo: "0",
  estoque_maximo: "0",
};

export function InsumosCrud() {
  const [search, setSearch] = useState("");

  const queryClient = useQueryClient();
  const { data: insumos, isLoading } = useQuery({
    queryKey: ["erp-insumos"],
    queryFn: listInsumos,
  });
  const { data: setores } = useQuery({
    queryKey: ["erp-setores"],
    queryFn: listSetores,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
  });

  // 3. Constante de filtragem para incluir a ordenação automática antes de renderizar - // Incluído por Marcello Ribeiro em 04.07.2026
  const insumosFiltrados e Ordenados = (insumos?.filter((i) =>
    i.nome.toLowerCase().includes(search.toLowerCase())
  ) ?? []).sort((a, b) => {
    if (!sortField) return 0;
    
    let valA = a[sortField];
    let valB = b[sortField];
  
    // Se for texto (nome), ignora maiúsculas/minúsculas
    if (typeof valA === "string") {
      return sortDirection === "asc" 
        ? valA.localeCompare(valB as string) 
        : (valB as string).localeCompare(valA);
    }
    
    // Se for número (custo_unitario)
    return sortDirection === "asc" 
      ? (valA as number) - (valB as number) 
      : (valB as number) - (valA as number);
  });  



  
  // 1. Estados para controlar a coluna ativa e a direção ('asc' = crescente, 'desc' = decrescente)
  const [sortField, setSortField] = useState<"nome" | "custo_unitario" | null>(null);  // Incluído por Marcello Ribeiro em 04.07.2026
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");  // Incluído por Marcello Ribeiro em 04.07.2026
  // 2. Função disparada ao clicar no título da coluna - // Incluído por Marcello Ribeiro em 04.07.2026
  const handleSort = (field: "nome" | "custo_unitario") => {
    if (sortField === field) {
      // Se clicar na mesma coluna, inverte a ordem ou desativa
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      // Se clicar em uma nova coluna, começa com ordenação crescente
      setSortField(field);
      setSortDirection("asc");
    }
  };

  
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const setorName = (id: string | null) => setores?.find((s) => s.id === id)?.setor ?? "—";
  const fornName = (id: string | null) => fornecedores?.find((f) => f.id === id)?.fornecedor ?? "—";

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (i: Insumo) => {
    setForm({
      id: i.id,
      nome: i.nome,
      unidade_medida: i.unidade_medida,
      unidade_estoque: i.unidade_estoque || i.unidade_medida,
      fator_conversao: String(i.fator_conversao ?? 1).replace(".", ","),
      controlado: i.controlado,
      custo_unitario: String(i.custo_unitario).replace(".", ","),
      estocavel: i.estocavel,
      fornecedor_id: i.fornecedor_id ?? NONE,
      setor_id: i.setor_id ?? NONE,
      estoque_minimo: String(i.estoque_minimo).replace(".", ","),
      estoque_maximo: String(i.estoque_maximo).replace(".", ","),
    });
    setOpen(true);
  };

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do insumo.");
      return;
    }
    setSaving(true);
    try {
      await saveInsumo({
        id: form.id,
        nome: form.nome,
        unidade_medida: form.unidade_medida,
        unidade_estoque: form.unidade_estoque,
        fator_conversao: parseNumberInput(form.fator_conversao),
        controlado: form.controlado,
        custo_unitario: parseNumberInput(form.custo_unitario),
        estocavel: form.estocavel,
        fornecedor_id: form.fornecedor_id === NONE ? null : form.fornecedor_id,
        setor_id: form.setor_id === NONE ? null : form.setor_id,
        estoque_minimo: parseNumberInput(form.estoque_minimo),
        estoque_maximo: parseNumberInput(form.estoque_maximo),
      });

      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["erp-insumos"] });
      toast.success("Insumo salvo!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(i: Insumo) {
    if (!confirm(`Remover o insumo "${i.nome}"?`)) return;
    try {
      await deleteInsumo(i.id);
      await queryClient.invalidateQueries({ queryKey: ["erp-insumos"] });
      toast.success("Insumo removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Insumos</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {insumos?.length ?? 0}
          </span>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo insumo
        </Button>
      </header>

      <div className="mb-4">
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do insumo..."
            className="h-11 rounded-xl"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (insumosFiltrados.length ?? 0) === 0 ? (  // Alterado Por Marcello Ribeiro Era ) : (insumos?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">Nenhum insumo cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {/* Coluna Insumo Clicável */}
                <th className="px-4 py-2.5 font-semibold cursor-pointer select-none hover:bg-secondary/80 transition-colors" onClick={() => handleSort("nome")}>
                  <div className="flex items-center gap-1">
                    Insumo
                    {sortField === "nome" && (sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                  </div>
                </th>
                
                <th className="px-4 py-2.5 font-semibold">Un.</th>
                
                {/* Coluna Custo Clicável */}
                <th className="px-4 py-2.5 font-semibold cursor-pointer select-none hover:bg-secondary/80 transition-colors" onClick={() => handleSort("custo_unitario")}>
                  <div className="flex items-center gap-1">
                    Custo
                    {sortField === "custo_unitario" && (sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                  </div>
                </th>
                
                <th className="px-4 py-2.5 font-semibold">Fornecedor</th>
                <th className="px-4 py-2.5 font-semibold">Setor</th>
                <th className="px-4 py-2.5 font-semibold">Saldo (mín/máx)</th>
                <th className="px-4 py-2.5 font-semibold">Estoque</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>

            <tbody>
              {insumosFiltradosEOrdenados.map((i, idx) => ( // Alterado por Marcello Ribeiro, era {insumos!.map((i, idx) => (
                <tr key={i.id} className={idx > 0 ? "border-t border-border" : ""}>
                  <td className="px-4 py-2.5 font-medium">{i.nome}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{i.unidade_medida}</td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-primary">{formatBRL(i.custo_unitario)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fornName(i.fornecedor_id)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{setorName(i.setor_id)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`font-semibold tabular-nums ${
                        i.estoque_minimo > 0 && i.saldo_estoque < i.estoque_minimo
                          ? "text-destructive"
                          : "text-foreground"
                      }`}
                    >
                      {i.saldo_estoque}
                    </span>
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      ({i.estoque_minimo}/{i.estoque_maximo})
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        i.estocavel
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {i.estocavel ? "Estocável" : "Não estocável"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <IconBtn label="Editar" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="Remover" destructive onClick={() => handleDelete(i)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-w-lg">
          <ModalActionBar
            title={form.id ? "Editar insumo" : "Novo insumo"}
            onBack={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Salvar"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Bacon em fatias"
              />
            </Field>
            <Field label="Unidade de medida (consumo)">
              <Input
                value={form.unidade_medida}
                onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })}
                placeholder="g, ml, un..."
              />
            </Field>
            <Field label="Unidade de estoque (compra)">
              <Input
                value={form.unidade_estoque}
                onChange={(e) => setForm({ ...form, unidade_estoque: e.target.value })}
                placeholder="kg, L, un..."
              />
            </Field>
            <Field label="Fator de conversão (consumo por unidade de estoque)">
              <Input
                inputMode="decimal"
                value={form.fator_conversao}
                onChange={(e) => setForm({ ...form, fator_conversao: e.target.value })}
                placeholder="Ex.: 1000 (1 kg = 1000 g)"
              />
            </Field>
            <Field label="Custo unitário (R$)">
              <Input
                inputMode="decimal"
                value={form.custo_unitario}
                onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })}
                placeholder="0,00"
              />
            </Field>

            <Field label="Fornecedor">
              <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {fornecedores?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.fornecedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Setor">
              <Select value={form.setor_id} onValueChange={(v) => setForm({ ...form, setor_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {setores?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Estoque mínimo (UE)">
              <Input
                inputMode="decimal"
                value={form.estoque_minimo}
                onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
                placeholder="0"
              />
            </Field>
            <Field label="Estoque máximo">
              <Input
                inputMode="decimal"
                value={form.estoque_maximo}
                onChange={(e) => setForm({ ...form, estoque_maximo: e.target.value })}
                placeholder="0"
              />
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5 sm:col-span-2">
              <div>
                <Label className="cursor-pointer">Item estocável</Label>
                <p className="text-xs text-muted-foreground">Desligue para mão de obra, gás, energia, impostos.</p>
              </div>
              <Switch checked={form.estocavel} onCheckedChange={(v) => setForm({ ...form, estocavel: v })} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5 sm:col-span-2">
              <div>
                <Label className="cursor-pointer">Controlado (trava de saldo)</Label>
                <p className="text-xs text-muted-foreground">
                  Base da futura trava atômica: impedirá vendas quando este insumo zerar.
                </p>
              </div>
              <Switch checked={form.controlado} onCheckedChange={(v) => setForm({ ...form, controlado: v })} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
