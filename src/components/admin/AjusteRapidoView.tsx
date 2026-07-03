import { useEffect, useMemo, useState } from "react";
import { Loader2, PackagePlus, FileCheck2, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ajusteRapidoEstoque,
  conciliarAjusteNf,
  listAjustesEstoque,
  listInsumosParaAjuste,
  type AjusteEstoque,
  type InsumoAjuste,
} from "@/lib/ajustes";

const parseNum = (s: string) => {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtQtd = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function AjusteRapidoView() {
  const [insumos, setInsumos] = useState<InsumoAjuste[]>([]);
  const [ajustes, setAjustes] = useState<AjusteEstoque[]>([]);
  const [loading, setLoading] = useState(true);

  const [insumoId, setInsumoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const [conciliar, setConciliar] = useState<AjusteEstoque | null>(null);

  const selected = useMemo(
    () => insumos.find((i) => i.id === insumoId),
    [insumos, insumoId],
  );

  async function load() {
    setLoading(true);
    try {
      const [ins, aj] = await Promise.all([
        listInsumosParaAjuste(),
        listAjustesEstoque(),
      ]);
      setInsumos(ins);
      setAjustes(aj);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar ajustes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    const qtd = parseNum(quantidade);
    if (!insumoId) {
      toast.error("Selecione um insumo.");
      return;
    }
    if (qtd === 0) {
      toast.error("Informe uma quantidade diferente de zero.");
      return;
    }
    setSaving(true);
    try {
      const novoSaldo = await ajusteRapidoEstoque({
        insumo_id: insumoId,
        quantidade: qtd,
        observacao: observacao.trim() || undefined,
      });
      toast.success(
        `Entrada lançada. Novo saldo: ${fmtQtd(novoSaldo)} ${selected?.unidade_estoque ?? ""}`,
      );
      setQuantidade("");
      setObservacao("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao lançar ajuste.");
    } finally {
      setSaving(false);
    }
  }

  const provisorios = ajustes.filter((a) => a.status === "Provisorio");
  const historico = ajustes.filter((a) => a.status === "Conciliado");

  return (
    <div className="space-y-6">
      {/* Entrada emergencial */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold">
            Ajuste Rápido / Entrada Emergencial
          </h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Libera o saldo na hora para as vendas e registra como{" "}
          <strong>Provisório</strong> no histórico. Concilie a NF depois para
          confirmar o valor real sem duplicar estoque.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Insumo</Label>
            <Select value={insumoId} onValueChange={setInsumoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o insumo" />
              </SelectTrigger>
              <SelectContent>
                {insumos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} — saldo {fmtQtd(i.saldo_estoque)} {i.unidade_estoque}
                    {i.controlado ? " • controlado" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aj-qtd">
              Quantidade recebida{selected ? ` (${selected.unidade_estoque})` : ""}
            </Label>
            <Input
              id="aj-qtd"
              inputMode="decimal"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Ex.: 50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aj-obs">Observação (opcional)</Label>
            <Input
              id="aj-obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: recebido sem NF"
            />
          </div>
        </div>

        <Button className="mt-4 w-full sm:w-auto" onClick={submit} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <PackagePlus className="mr-1 h-4 w-4" />
          )}
          Lançar entrada
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Provisórios pendentes de NF */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <h3 className="font-display text-sm font-bold">
                Provisórios — pendentes de NF ({provisorios.length})
              </h3>
            </div>
            {provisorios.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma entrada provisória pendente.
              </p>
            ) : (
              <div className="space-y-2">
                {provisorios.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.insumo_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        +{fmtQtd(a.quantidade)} {a.unidade_estoque} • {fmtDate(a.created_at)}
                        {a.observacao ? ` • ${a.observacao}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0 gap-1"
                      onClick={() => setConciliar(a)}
                    >
                      <FileCheck2 className="h-4 w-4" /> Conciliar NF
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico conciliado */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <h3 className="font-display text-sm font-bold">
                Conciliados ({historico.length})
              </h3>
            </div>
            {historico.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conciliação ainda.</p>
            ) : (
              <div className="space-y-2">
                {historico.map((a) => (
                  <div key={a.id} className="rounded-xl bg-secondary px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{a.insumo_nome}</p>
                      <Badge variant="secondary" className="shrink-0 text-emerald-600">
                        Conciliado
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Provisório {fmtQtd(a.quantidade)} → NF{" "}
                      {fmtQtd(a.quantidade_nf ?? a.quantidade)} {a.unidade_estoque}
                      {a.ajuste_fino != null && a.ajuste_fino !== 0
                        ? ` • ajuste fino ${a.ajuste_fino > 0 ? "+" : ""}${fmtQtd(a.ajuste_fino)}`
                        : " • sem diferença"}
                      {a.nf_referencia ? ` • NF ${a.nf_referencia}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ConciliarDialog
        ajuste={conciliar}
        onClose={() => setConciliar(null)}
        onDone={async () => {
          setConciliar(null);
          await load();
        }}
      />
    </div>
  );
}

function ConciliarDialog({
  ajuste,
  onClose,
  onDone,
}: {
  ajuste: AjusteEstoque | null;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [qtdNf, setQtdNf] = useState("");
  const [nfRef, setNfRef] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ajuste) {
      setQtdNf(String(ajuste.quantidade).replace(".", ","));
      setNfRef("");
    }
  }, [ajuste]);

  async function submit() {
    if (!ajuste) return;
    const qtd = parseNum(qtdNf);
    setSaving(true);
    try {
      const saldo = await conciliarAjusteNf({
        ajuste_id: ajuste.id,
        quantidade_nf: qtd,
        nf_referencia: nfRef.trim() || undefined,
      });
      const fino = qtd - ajuste.quantidade;
      toast.success(
        fino === 0
          ? `Conciliado sem diferença. Saldo: ${fmtQtd(saldo)} ${ajuste.unidade_estoque}`
          : `Conciliado. Ajuste fino ${fino > 0 ? "+" : ""}${fmtQtd(fino)} • saldo ${fmtQtd(saldo)} ${ajuste.unidade_estoque}`,
      );
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao conciliar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!ajuste} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conciliar Nota Fiscal</DialogTitle>
        </DialogHeader>
        {ajuste && (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary px-3 py-2.5 text-sm">
              <p className="font-semibold">{ajuste.insumo_nome}</p>
              <p className="text-xs text-muted-foreground">
                Entrada provisória: {fmtQtd(ajuste.quantidade)} {ajuste.unidade_estoque}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nf-qtd">
                Quantidade da NF ({ajuste.unidade_estoque})
              </Label>
              <Input
                id="nf-qtd"
                inputMode="decimal"
                value={qtdNf}
                onChange={(e) => setQtdNf(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O sistema aplica só a diferença (ajuste fino) para não duplicar
                estoque.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nf-ref">Nº / referência da NF (opcional)</Label>
              <Textarea
                id="nf-ref"
                rows={2}
                value={nfRef}
                onChange={(e) => setNfRef(e.target.value)}
                placeholder="Ex.: NF-e 12345 - Distribuidora X"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Confirmar conciliação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
