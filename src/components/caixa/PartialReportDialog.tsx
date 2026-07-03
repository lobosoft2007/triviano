import { useQuery } from "@tanstack/react-query";
import { Loader2, Wallet, Banknote } from "lucide-react";
import {
  buildPartialReport,
  fetchMovimentacoes,
  type Caixa,
} from "@/lib/caixa";
import { formatBRL } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

/**
 * Real-time partial cash audit ("X de caixa"): opening, revenue grouped
 * dynamically by payment method, sangrias, total balance and expected cash
 * in the drawer.
 */
export function PartialReportDialog({
  caixa,
  open,
  onOpenChange,
}: {
  caixa: Caixa;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: report, isLoading } = useQuery({
    queryKey: ["caixa-partial", caixa.id, open],
    enabled: open,
    queryFn: async () => {
      const movs = await fetchMovimentacoes(caixa.id);
      return buildPartialReport(caixa, movs);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-h-[90vh] max-w-md overflow-y-auto">
        <ModalActionBar
          title="Caixa do momento (parcial)"
          onBack={() => onOpenChange(false)}
          hideSave
        />

        {isLoading || !report ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <Row
              label="Valor de abertura (gaveta)"
              value={report.valorAbertura}
            />

            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Faturado por meio de pagamento
              </p>
              {report.porMeio.length === 0 ? (
                <p className="text-muted-foreground">
                  Nenhum recebimento registrado ainda.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {report.porMeio.map((m) => (
                    <Row
                      key={m.nome}
                      label={meioLabel(m.nome, m.informativo)}
                      value={m.total}
                      muted
                    />
                  ))}
                </div>
              )}
            </div>

            <Row
              label="Total de entradas"
              value={report.totalEntradas}
              className="text-success"
            />
            <Row
              label="Sangrias / saídas"
              value={-report.totalSangrias}
              className="text-destructive"
            />

            <div className="space-y-2 rounded-xl bg-card p-3 shadow-card">
              <div className="flex items-center justify-between font-display font-bold">
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-primary" /> Saldo total do
                  restaurante
                </span>
                <span className="tabular-nums text-primary">
                  {formatBRL(report.saldoTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between font-display font-bold">
                <span className="flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-success" /> Esperado em
                  dinheiro na gaveta
                </span>
                <span className="tabular-nums text-success">
                  {formatBRL(report.saldoGavetaDinheiro)}
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Friendly label per payment method, flagging non-cash modalities. */
function meioLabel(nome: string, informativo?: boolean): string {
  if (nome === "Cashback") return "Cashback (uso de pontos)";
  if (nome === "Fiado") return "Fiado (vendas a prazo)";
  return informativo ? `${nome} (não-caixa)` : nome;
}


function Row({
  label,
  value,
  muted,
  className = "",
}: {
  label: string;
  value: number;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`font-semibold tabular-nums ${className}`}>
        {formatBRL(value)}
      </span>
    </div>
  );
}
