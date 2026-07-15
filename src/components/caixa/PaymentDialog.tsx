import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, CheckCircle2, AlertCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMeiosPagamento,
  fetchPagamentos,
  addPagamento,
  deletePagamento,
  finalizeOrderPaid,
  type CaixaOrder,
} from "@/lib/caixa";
import { insertNotification } from "@/lib/notifications";
import { empresaQueryOptions, empresaAdminConfigQueryOptions } from "@/lib/empresa";

import { fetchMpPublicConfig } from "@/lib/mercadopago";
import { PdvPixCharge } from "@/components/checkout/PdvPixCharge";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

/** Integer cents to avoid floating-point comparison drift. */
const toCents = (n: number) => Math.round(n * 100);

export function PaymentDialog({
  order,
  open,
  onOpenChange,
}: {
  order: CaixaOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery(empresaQueryOptions);
  const { data: empresaAdmin } = useQuery({
    ...empresaAdminConfigQueryOptions,
    enabled: open,
  });
  const brand = empresa?.nome_fantasia || "";
  // Taxa de entrega fixa da empresa — só somada quando o pedido é DELIVERY.
  const taxaEntrega =
    order.tipo_atendimento === "Delivery"
      ? Number(empresaAdmin?.taxa_entrega_valor ?? 0)
      : 0;



  const { data: meios } = useQuery({
    queryKey: ["meios-pagamento"],
    queryFn: () => fetchMeiosPagamento(true),
    enabled: open,
  });
  const { data: pagamentos, isLoading } = useQuery({
    queryKey: ["pagamentos", order.id],
    queryFn: () => fetchPagamentos(order.id),
    enabled: open,
  });

  // Configuração pública do Mercado Pago do tenant (só chave pública).
  const { data: mpConfig } = useQuery({
    queryKey: ["mp-public-config"],
    queryFn: fetchMpPublicConfig,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const mpPixActive = !!mpConfig?.ativo && !!mpConfig?.aceita_pix_online;

  const [meioId, setMeioId] = useState("");
  const [valor, setValor] = useState("");
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  // Cobrança PIX online (QR dinâmico do Mercado Pago) para o total do pedido.
  const [onlinePix, setOnlinePix] = useState(false);

  // Default the selector to the first active method once they load.
  useEffect(() => {
    if (!meioId && meios && meios.length > 0) setMeioId(meios[0].id);
  }, [meios, meioId]);

  const totalPagoCents = useMemo(
    () => (pagamentos ?? []).reduce((s, p) => s + toCents(p.valor_pago), 0),
    [pagamentos],
  );
  const totalConta = Math.round((order.total + taxaEntrega) * 100) / 100;
  const totalCents = toCents(totalConta);

  const restanteCents = totalCents - totalPagoCents;
  const restante = restanteCents / 100;
  const matches = restanteCents === 0;
  // PIX online cobra sempre o TOTAL do pedido (a Order do MP não é parcial),
  // então só é oferecido quando ainda não há pagamento parcial lançado.
  const canOnlinePix = mpPixActive && totalPagoCents === 0 && totalCents > 0;
  const pixMeio = useMemo(
    () => (meios ?? []).find((m) => m.nome.trim().toLowerCase() === "pix"),
    [meios],
  );


  async function handleAdd() {
    const v = Number(valor.replace(",", "."));
    if (Number.isNaN(v) || v <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!meioId) {
      toast.error("Selecione um meio de pagamento.");
      return;
    }
    setBusy(true);
    try {
      await addPagamento({ orderId: order.id, meioId, valor: v });
      await queryClient.invalidateQueries({ queryKey: ["pagamentos", order.id] });
      setValor("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar.");
    } finally {
      setBusy(false);
    }
  }

  function fillRemaining() {
    if (restanteCents > 0) setValor((restanteCents / 100).toFixed(2));
  }

  async function handleRemove(id: string) {
    try {
      await deletePagamento(id);
      await queryClient.invalidateQueries({ queryKey: ["pagamentos", order.id] });
    } catch {
      toast.error("Erro ao remover pagamento.");
    }
  }

  async function handleFinalize() {
    if (!matches) return;
    const usouFiado = (pagamentos ?? []).some((p) => p.meio_nome === "Fiado");
    setFinalizing(true);
    try {
      const saldoDevedor = await finalizeOrderPaid(order.id);
      // Fiado purchase -> instant push notification to the customer.
      if (usouFiado && order.user_id) {
        const valorFiado = (pagamentos ?? [])
          .filter((p) => p.meio_nome === "Fiado")
          .reduce((s, p) => s + p.valor_pago, 0);
        try {
          await insertNotification({
            idPedido: order.id,
            idUsuario: order.user_id,
            titulo: "Compra no Fiado registrada",
            mensagem: `${brand}: Compra de ${formatBRL(
              valorFiado,
            )} registrada no Fiado. Seu saldo devedor atual é ${formatBRL(
              saldoDevedor,
            )}.`,
          });
        } catch {
          /* best-effort; bell/whatsapp fallback */
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["caixa-movs"] });
      toast.success(`Pedido #${order.id.slice(0, 6).toUpperCase()} baixado.`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar.";
      if (msg.includes("ESTOQUE_INSUFICIENTE")) {
        const insumo = msg.split("ESTOQUE_INSUFICIENTE:")[1]?.trim() || "um insumo";
        toast.error(
          `Estoque insuficiente: "${insumo}" acabou de esgotar na cozinha. Ajuste o pedido ou reponha o estoque para prosseguir.`,
          { duration: 8000 },
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setFinalizing(false);
    }
  }

  /**
   * Called by <PdvPixCharge> once the webhook confirms the online PIX. Records
   * the PIX payment for the full order total and finalizes the settlement,
   * reusing the same server RPC as the manual flow.
   */
  async function handleOnlinePixConfirmed() {
    if (finalizing) return;
    if (!pixMeio) {
      toast.error("Meio de pagamento PIX não configurado.");
      return;
    }
    setFinalizing(true);
    try {
      await addPagamento({
        orderId: order.id,
        meioId: pixMeio.id,
        valor: order.total,
      });
      await finalizeOrderPaid(order.id);
      await queryClient.invalidateQueries({ queryKey: ["pagamentos", order.id] });
      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["caixa-movs"] });
      toast.success(`Pedido #${order.id.slice(0, 6).toUpperCase()} pago via PIX.`);
      setOnlinePix(false);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar.";
      if (msg.includes("ESTOQUE_INSUFICIENTE")) {
        const insumo = msg.split("ESTOQUE_INSUFICIENTE:")[1]?.trim() || "um insumo";
        toast.error(
          `Estoque insuficiente: "${insumo}" acabou de esgotar na cozinha. Reponha o estoque para prosseguir.`,
          { duration: 8000 },
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-h-[90vh] max-w-md overflow-y-auto">
        <ModalActionBar
          title={
            onlinePix
              ? `PIX · #${order.id.slice(0, 6).toUpperCase()}`
              : `Dividir pagamento · #${order.id.slice(0, 6).toUpperCase()}`
          }
          onBack={() => (onlinePix ? setOnlinePix(false) : onOpenChange(false))}
          onSave={handleFinalize}
          saving={finalizing}
          saveDisabled={!matches}
          saveLabel="Finalizar"
          hideSave={onlinePix}
        />

        {onlinePix && mpConfig ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-secondary p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total a receber
              </p>
              <p className="font-display text-2xl font-black tabular-nums">
                {formatBRL(order.total)}
              </p>
            </div>
            <PdvPixCharge
              orderId={order.id}
              total={order.total}
              config={mpConfig}
              context="mesa"
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
          {/* Add line */}
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
              <Button onClick={handleAdd} disabled={busy} size="icon" className="h-10 w-10 shrink-0">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
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

          {/* Lines */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (pagamentos?.length ?? 0) === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Nenhum pagamento lançado ainda.
              </p>
            ) : (
              pagamentos!.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  <span className="font-medium">{p.meio_nome}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatBRL(p.valor_pago)}
                    </span>
                    <button
                      onClick={() => handleRemove(p.id)}
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

          {/* Summary */}
          <div className="space-y-1 rounded-xl bg-card p-3 text-sm shadow-card">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total do pedido</span>
              <span className="tabular-nums">{formatBRL(order.total)}</span>
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
              <span className="tabular-nums">{formatBRL(Math.abs(restante))}</span>
            </div>
          </div>

          {!matches && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              A soma dos pagamentos precisa bater exatamente com o total para
              baixar o pedido.
            </p>
          )}
        </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
