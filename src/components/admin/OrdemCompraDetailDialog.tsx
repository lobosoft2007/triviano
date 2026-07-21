import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent } from "@/components/ui/dialog";
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

import { listFornecedores, parseNumberInput } from "@/lib/erp";
import {
  atualizarOrdemCompra,
  excluirOrdemCompra,
  getOrdemCompra,
  type OrdemCompraItem,
} from "@/lib/estoque";
import { formatBRL } from "@/lib/format";
import {
  RelatorioOrdemCompraDialog,
  type OrdemCompraLinha,
} from "./reports/RelatorioOrdemCompra";

const NONE = "__none__";

interface EditRow {
  key: string;
  tipo: OrdemCompraItem["tipo"];
  ref_id: string | null;
  nome: string;
  quantidade: string;
  custo: string;
}

export function OrdemCompraDetailDialog({
  ordemId,
  onOpenChange,
}: {
  ordemId: string | null;
  onOpenChange: (v: boolean) => void;
}) {
  const open = ordemId !== null;
  const queryClient = useQueryClient();

  const { data: fornecedores } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
    enabled: open,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const {
    data: ordem,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["ordem-compra", ordemId],
    queryFn: () => getOrdemCompra(ordemId!),
    enabled: open,
  });

  const [rows, setRows] = useState<EditRow[]>([]);
  const [fornId, setFornId] = useState<string>(NONE);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<"print" | "share" | "download" | null>(null);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "landscape",
  );

  const editavel = (ordem?.status ?? "Aberta") === "Aberta";

  useEffect(() => {
    if (ordem) {
      setRows(
        ordem.itens.map((i, idx) => ({
          key: `${i.id ?? idx}`,
          tipo: i.tipo,
          ref_id: i.ref_id,
          nome: i.nome,
          quantidade: String(i.quantidade).replace(".", ","),
          custo: String(i.custo_unitario).replace(".", ","),
        })),
      );
      setFornId(ordem.id_fornecedor ?? NONE);
      setObservacao(ordem.observacao ?? "");
    }
  }, [ordem]);

  const patchRow = (key: string, patch: Partial<EditRow>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeRow = (key: string) =>
    setRows((r) => r.filter((row) => row.key !== key));
  const addLivre = () =>
    setRows((r) => [
      ...r,
      {
        key: `new-${Date.now()}-${r.length}`,
        tipo: "livre",
        ref_id: null,
        nome: "",
        quantidade: "",
        custo: "",
      },
    ]);

  const total = useMemo(() => {
    let t = 0;
    for (const r of rows) {
      const q = parseNumberInput(r.quantidade);
      const c = parseNumberInput(r.custo);
      if (q > 0) t += q * c;
    }
    return t;
  }, [rows]);

  const fornMap = useMemo(
    () => new Map((fornecedores ?? []).map((f) => [f.id, f])),
    [fornecedores],
  );
  const fornEfetivo =
    fornId !== NONE
      ? fornMap.get(fornId)
      : ordem?.id_fornecedor
        ? fornMap.get(ordem.id_fornecedor)
        : undefined;

  const reportRows: OrdemCompraLinha[] = useMemo(
    () =>
      rows
        .filter((r) => parseNumberInput(r.quantidade) > 0)
        .map((r) => ({
          nome: r.nome || "(item)",
          tipo: r.tipo === "produto" ? "produto" : r.tipo === "livre" ? "livre" : "insumo",
          setor: "",
          fornecedor: fornEfetivo?.fornecedor ?? "",
          unidade: "",
          quantidade: parseNumberInput(r.quantidade),
          custo_unitario: parseNumberInput(r.custo),
        })),
    [rows, fornEfetivo],
  );


  async function handleSave() {
    if (!ordem || !editavel) return;
    setSaving(true);
    try {
      await atualizarOrdemCompra({
        id: ordem.id,
        id_fornecedor: fornId !== NONE ? fornId : null,
        observacao,
        itens: rows.map((r) => ({
          tipo: r.tipo === "produto" ? "produto" : "insumo",
          ref_id: r.ref_id,
          nome: r.nome.trim(),
          quantidade: parseNumberInput(r.quantidade),
          custo_unitario: parseNumberInput(r.custo),
        })),
      });
      toast.success("Ordem atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["ordens-compra"] });
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ordem || !editavel) return;
    if (!confirm(`Excluir a Ordem de Compra nº ${ordem.numero}? Esta ação não pode ser desfeita.`))
      return;
    setDeleting(true);
    try {
      await excluirOrdemCompra(ordem.id);
      toast.success(`Ordem nº ${ordem.numero} excluída.`);
      await queryClient.invalidateQueries({ queryKey: ["ordens-compra"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenPreview() {
    if (reportRows.length === 0) {
      toast.error("Nenhum item para visualizar.");
      return;
    }
    setPreviewOpen(true);
  }


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent hideClose className="flex h-[92dvh] max-h-[92dvh] max-w-4xl flex-col p-0">
          <ModalActionBar
            title={
              ordem
                ? `Ordem de Compra nº ${ordem.numero}${!editavel ? ` · ${ordem.status}` : ""}`
                : "Ordem de Compra"
            }
            onBack={() => onOpenChange(false)}
            onSave={editavel ? handleSave : undefined}
            saving={saving}
            saveLabel="Salvar alterações"
            saveDisabled={!editavel || rows.length === 0}
            className="mx-0 mt-0"
          />

          {isLoading || !ordem ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Total da ordem
                    </p>
                    <p className="font-display text-2xl font-bold tabular-nums text-primary">
                      {formatBRL(total)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {rows.length} item(ns) · criada em{" "}
                      {new Date(ordem.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenPreview}
                      className="gap-1.5"
                    >
                      <Eye className="h-4 w-4" />
                      Visualizar relatório
                    </Button>
                    {editavel && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="gap-1.5"
                      >
                        {deleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Excluir
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(200px,260px)_1fr]">
                  <Select
                    value={fornId}
                    onValueChange={setFornId}
                    disabled={!editavel}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Fornecedor" />
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
                  <Input
                    className="h-9"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Observação (opcional)"
                    disabled={!editavel}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] bg-secondary/80 text-left text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Item</th>
                      <th className="px-2 py-2 text-right font-semibold">Custo un.</th>
                      <th className="px-2 py-2 text-right font-semibold">Quantidade</th>
                      <th className="px-2 py-2 text-right font-semibold">Subtotal</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const q = parseNumberInput(r.quantidade);
                      const c = parseNumberInput(r.custo);
                      return (
                        <tr key={r.key} className="border-t border-border align-middle">
                          <td className="px-2 py-1.5">
                            <Input
                              className="h-8"
                              value={r.nome}
                              onChange={(e) => patchRow(r.key, { nome: e.target.value })}
                              disabled={!editavel || r.tipo !== "livre"}
                            />
                            <div className="mt-0.5 text-[10px] uppercase text-muted-foreground">
                              {r.tipo === "produto"
                                ? "revenda"
                                : r.tipo === "livre"
                                  ? "livre"
                                  : "insumo"}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              className="ml-auto h-8 w-24 text-right"
                              inputMode="decimal"
                              value={r.custo}
                              onChange={(e) => patchRow(r.key, { custo: e.target.value })}
                              disabled={!editavel}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              className="ml-auto h-8 w-24 text-right"
                              inputMode="decimal"
                              value={r.quantidade}
                              onChange={(e) => patchRow(r.key, { quantidade: e.target.value })}
                              disabled={!editavel}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                            {q > 0 ? formatBRL(q * c) : "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            {editavel && (
                              <button
                                type="button"
                                aria-label="Remover"
                                onClick={() => removeRow(r.key)}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          Nenhum item nesta ordem.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {editavel && (
                  <div className="mt-3">
                    <Button variant="secondary" size="sm" onClick={addLivre} className="gap-1.5">
                      <Plus className="h-4 w-4" /> Adicionar item livre
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <RelatorioOrdemCompraDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={ordem ? `Ordem de Compra nº ${ordem.numero}` : "Ordem de Compra"}
        rows={reportRows}
        observacao={observacao}
      />
    </>
  );
}
