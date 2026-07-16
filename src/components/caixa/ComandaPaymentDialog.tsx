import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  QrCode,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { fetchMeiosPagamento } from "@/lib/caixa";
import {
  finalizeComandaSplit,
  type ComandaPagamentoSplit,
} from "@/lib/mesa";
import { fetchMpPublicConfig } from "@/lib/mercadopago";
import { empresaAdminConfigQueryOptions } from "@/lib/empresa";
import { ComandaPixCharge } from "@/components/checkout/ComandaPixCharge";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

/** Cents helper — avoids floating drift on the "restante" check. */
const toCents = (n: number) => Math.round(n * 100);

interface DraftPagamento {
  key: string;
  meio_id: string;
  meio_nome: string;
  valor: number;
}

/**
 * Liquidação UNIFICADA da comanda no Caixa (v1.7.4) — agora com SPLIT.
 * O operador lança várias formas de pagamento até bater 100% do total (que
 * inclui a gorjeta sugerida quando ligada). Cada linha vira uma entrada em
 * pagamentos_pedido, distribuída proporcionalmente entre os pedidos da mesa
 * pelo servidor (finalize_comanda_split), que reaproveita o motor financeiro
 * já existente. PIX online segue como caminho separado (cobra o total via QR).
 */
export function ComandaPaymentDialog({
  comandaId,
  numeroMesa,
  total,
  open,
  onOpenChange,
}: {
  comandaId: string;
  numeroMesa: number;
  total: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: meios } = useQuery({
    queryKey: ["meios-pagamento"],
    queryFn: () => fetchMeiosPagamento(true),
    enabled: open,
  });
  const { data: mpConfig } = useQuery({
    queryKey: ["mp-public-config"],
    queryFn: fetchMpPublicConfig,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  // Gorjeta sugerida pela empresa (% configurável no Admin).
  const { data: empresaConfig } = useQuery({
    ...empresaAdminConfigQueryOptions,
    enabled: open,
  });
  const gorjetaPct = Number(empresaConfig?.taxa_servico_mesa ?? 0);
  const gorjetaAtiva = gorjetaPct > 0;
  const [incluirGorjeta, setIncluirGorjeta] = useState(true);
  useEffect(() => {
    // Reseta a preferência sempre que abre para uma nova mesa.
    if (open) setIncluirGorjeta(gorjetaAtiva);
  }, [open, gorjetaAtiva]);

  const valorGorjeta = useMemo(
    () =>
      gorjetaAtiva && incluirGorjeta
        ? Math.round(total * gorjetaPct) / 100
        : 0,
    [gorjetaAtiva, incluirGorjeta, gorjetaPct, total],
  );
  const totalConta = useMemo(
    () => Math.round((total + valorGorjeta) * 100) / 100,
    [total, valorGorjeta],
  );

  const mpPixActive = !!mpConfig?.ativo && !!mpConfig?.aceita_pix_online;

  // ---- Formulário de split ----------------------------------------
  const [meioId, setMeioId] = useState("");
  const [valor, setValor] = useState("");
  const [drafts, setDrafts] = useState<DraftPagamento[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [onlinePix, setOnlinePix] = useState(false);

  useEffect(() => {
    if (!meioId && meios && meios.length > 0) setMeioId(meios[0].id);
  }, [meios, meioId]);
  // Zera o carrinho de pagamentos ao abrir/fechar.
  useEffect(() => {
    if (open) {
      setDrafts([]);
      setValor("");
      setOnlinePix(false);
    }
  }, [open]);

  const totalPagoCents = useMemo(
    () => drafts.reduce((s, d) => s + toCents(d.valor), 0),
    [drafts],
  );
  const totalContaCents = toCents(totalConta);
  const restanteCents = totalContaCents - totalPagoCents;
  const restante = restanteCents / 100;
  const matches = restanteCents === 0 && drafts.length > 0;
  const canOnlinePix = mpPixActive && drafts.length === 0 && totalContaCents > 0;

  function handleAdd() {
    const v = Number(valor.replace(",", "."));
    if (Number.isNaN(v) || v <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!meioId) {
      toast.error("Selecione um meio de pagamento.");
      return;
    }
    const meio = (meios ?? []).find((m) => m.id === meioId);
    if (!meio) return;
    setDrafts((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        meio_id: meioId,
        meio_nome: meio.nome,
        valor: Math.round(v * 100) / 100,
      },
    ]);
    setValor("");
  }

  function fillRemaining() {
    if (restanteCents > 0) setValor((restanteCents / 100).toFixed(2));
  }

  function handleRemove(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["caixa-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["caixa-movs"] }),
      queryClient.invalidateQueries({ queryKey: ["mesa-fechamentos"] }),
      queryClient.invalidateQueries({ queryKey: ["mesas-vivas"] }),
    ]);
  }

  async function handleFinalize() {
    if (!matches) return;
    setFinalizing(true);
    try {
      const payload: ComandaPagamentoSplit[] = drafts.map((d) => ({
        meio_id: d.meio_id,
        valor: d.valor,
      }));
      await finalizeComandaSplit(comandaId, payload);
      await invalidateAll();
      toast.success(`Mesa ${numeroMesa} liquidada com sucesso! 🎉`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar.";
      if (msg.includes("ESTOQUE_INSUFICIENTE")) {
        const insumo =
          msg.split("ESTOQUE_INSUFICIENTE:")[1]?.trim() || "um insumo";
        toast.error(
          `Estoque insuficiente: "${insumo}" acabou de esgotar. Reponha o estoque para prosseguir.`,
          { duration: 8000 },
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setFinalizing(false);
    }
  }

  async function handleOnlinePixConfirmed() {
    // Webhook já liquidou a comanda; aqui só refresh de UI.
    await invalidateAll();
    toast.success(`Mesa ${numeroMesa} paga via PIX! 🎉`);
    setOnlinePix(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-h-[90vh] max-w-lg overflow-y-auto">
        <ModalActionBar
          title={
            onlinePix
              ? `PIX · Mesa ${numeroMesa}`
              : `Finalizar e Receber · Mesa ${numeroMesa}`
          }
          onBack={() => (onlinePix ? setOnlinePix(false) : onOpenChange(false))}
          onSave={handleFinalize}
          saving={finalizing}
          saveDisabled={!matches}
          saveLabel="Finalizar e Receber"
          hideSave={onlinePix}
        />

        {onlinePix && mpConfig ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-secondary p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total a receber
              </p>
              <p className="font-display text-2xl font-black tabular-nums">
                {formatBRL(totalConta)}
              </p>
            </div>
            <ComandaPixCharge
              comandaId={comandaId}
              total={totalConta}
              config={mpConfig}
              onConfirmed={handleOnlinePixConfirmed}
            />
            <Button
              variant="ghost"
              onClick={() => setOnlinePix(false)}
              disabled={finalizing}
              className="h-11 w-full rounded-xl font-semibold text-muted-foreground"
            >
              Voltar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {canOnlinePix && (
              <Button
                type="button"
                onClick={() => setOnlinePix(true)}
                className="h-12 w-full rounded-xl text-base font-bold"
              >
                <QrCode className="mr-2 h-5 w-5" /> Cobrar PIX online (total)
              </Button>
            )}

            {/* Split — Adicionar pagamento */}
            <div className="space-y-2 rounded-xl border border-border p-3">
              <Label>Adicionar pagamento</Label>
              <div className="flex gap-2">
                <select
                  value={meioId}
                  onChange={(e) => setMeioId(e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {(meios ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
                <Input
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="h-10 w-28 rounded-lg"
                />
                <Button
                  onClick={handleAdd}
                  size="icon"
                  className="h-10 w-10 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {restanteCents > 0 && (
                <button
                  onClick={fillRemaining}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Preencher restante ({formatBRL(restante)})
                </button>
              )}
            </div>

            {/* Linhas lançadas */}
            <div className="space-y-2">
              {drafts.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Nenhum pagamento lançado ainda.
                </p>
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.key}
                    className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{d.meio_nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">
                        {formatBRL(d.valor)}
                      </span>
                      <button
                        onClick={() => handleRemove(d.key)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Gorjeta sugerida (só quando > 0%) */}
            {gorjetaAtiva && (
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="block font-semibold">
                    Gorjeta ({gorjetaPct}% — sugerida)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatBRL(valorGorjeta)} · Pode remover se o cliente pedir.
                  </span>
                </div>
                <Switch
                  checked={incluirGorjeta}
                  onCheckedChange={setIncluirGorjeta}
                />
              </label>
            )}

            {/* Resumo */}
            <div className="space-y-1 rounded-xl bg-card p-3 text-sm shadow-card">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Consumo dos pedidos
                </span>
                <span className="tabular-nums">{formatBRL(total)}</span>
              </div>
              {valorGorjeta > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Gorjeta ({gorjetaPct}%)
                  </span>
                  <span className="tabular-nums">{formatBRL(valorGorjeta)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span>Total da conta</span>
                <span className="tabular-nums">{formatBRL(totalConta)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total pago</span>
                <span className="tabular-nums">
                  {formatBRL(totalPagoCents / 100)}
                </span>
              </div>
              <div
                className={`flex justify-between border-t border-border pt-1 font-display font-bold ${
                  matches ? "text-success" : "text-destructive"
                }`}
              >
                <span>{restanteCents >= 0 ? "Restante" : "Excedente"}</span>
                <span className="tabular-nums">
                  {formatBRL(Math.abs(restante))}
                </span>
              </div>
            </div>

            {!matches && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                A soma dos pagamentos precisa bater exatamente com o total para
                fechar a mesa.
              </p>
            )}

            {finalizing && (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Liquidando conta…
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
