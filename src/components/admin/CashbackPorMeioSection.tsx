import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Coins, Save } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMeiosPagamento,
  updateMeioCashback,
  type MeioPagamento,
} from "@/lib/caixa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Cashback percentage per payment method. The manager defines how much cashback
 * each active payment method grants (e.g. PIX 5%, Dinheiro 2%, Cartão 0%). The
 * engine (`award_order_cashback`) reads these values when an order is paid.
 */
export function CashbackPorMeioSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["meios-cashback"],
    queryFn: () => fetchMeiosPagamento(false),
  });

  return (
    <section className="mt-8 w-full">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">
            Cashback por meio de pagamento
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina o percentual de cashback que cada forma de pagamento devolve ao
          cliente. Ex.: PIX 5%, Dinheiro 2%, Cartão 0% (desativado). O bônus é
          calculado sobre o valor efetivamente pago em cada meio.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhum meio de pagamento cadastrado.
        </p>
      ) : (
        <div className="space-y-3">
          {data!.map((m) => (
            <MeioRow
              key={m.id}
              meio={m}
              onSaved={() =>
                queryClient.invalidateQueries({ queryKey: ["meios-cashback"] })
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MeioRow({
  meio,
  onSaved,
}: {
  meio: MeioPagamento;
  onSaved: () => void;
}) {
  const [pct, setPct] = useState(String(meio.percentual_cashback));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPct(String(meio.percentual_cashback));
  }, [meio.percentual_cashback]);

  const parsed = Number(pct.replace(",", "."));
  const dirty = Number.isFinite(parsed) && parsed !== meio.percentual_cashback;

  async function handleSave() {
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Informe um percentual entre 0 e 100.");
      return;
    }
    setSaving(true);
    try {
      await updateMeioCashback(meio.id, parsed);
      toast.success(`Cashback de ${meio.nome} atualizado para ${parsed}%.`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="min-w-0">
        <p className="font-semibold">{meio.nome}</p>
        {!meio.ativo && (
          <span className="text-xs text-muted-foreground">Inativo</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Input
            inputMode="decimal"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="h-9 w-24 rounded-lg pr-7 text-right tabular-nums"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
