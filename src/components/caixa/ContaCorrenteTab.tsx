import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Printer,
  HandCoins,
  Search,
  Save,
} from "lucide-react";
import {
  fetchFiadoClients,
  setFiadoConfig,
  payFiado,
  fetchExtratoFiado,
  type FiadoClient,
  type ExtratoFiadoRow,
} from "@/lib/fiado";
import { fetchMeiosPagamento } from "@/lib/caixa";
import { empresaQueryOptions } from "@/lib/empresa";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const toCents = (n: number) => Math.round(n * 100);

export type ContaCorrenteMode = "caixa" | "admin";

/**
 * Customer account (conta corrente) panel.
 * - mode="caixa": operator can register payments and print statements, but
 *   cannot change the credit limit or authorize fiado.
 * - mode="admin": manager can change the credit limit and authorize fiado and
 *   print statements, but cannot register payments (done at the cash register).
 */
export function ContaCorrenteTab({ mode = "caixa" }: { mode?: ContaCorrenteMode }) {
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery(empresaQueryOptions);
  const RESTAURANT = empresa?.nome_fantasia ?? "";
  const [search, setSearch] = useState("");
  const [payTarget, setPayTarget] = useState<FiadoClient | null>(null);
  const [printRows, setPrintRows] = useState<ExtratoFiadoRow[] | null>(null);
  const [printClient, setPrintClient] = useState<FiadoClient | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["fiado-clients"],
    queryFn: fetchFiadoClients,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clients ?? [];
    if (!q) return list;
    return list.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [clients, search]);

  async function handlePrintExtrato(client: FiadoClient) {
    try {
      const rows = await fetchExtratoFiado(client.id);
      setPrintClient(client);
      setPrintRows(rows);
      await new Promise((r) => setTimeout(r, 150));
      window.print();
      await new Promise((r) => setTimeout(r, 200));
      setPrintRows(null);
      setPrintClient(null);
    } catch {
      toast.error("Não foi possível carregar o extrato.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone…"
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              onPay={() => setPayTarget(c)}
              onExtrato={() => handlePrintExtrato(c)}
            />
          ))}
        </div>
      )}

      {payTarget && (
        <PayDialog
          client={payTarget}
          open={!!payTarget}
          onOpenChange={(v) => {
            if (!v) setPayTarget(null);
          }}
          onPaid={() => {
            queryClient.invalidateQueries({ queryKey: ["fiado-clients"] });
            queryClient.invalidateQueries({ queryKey: ["caixa-movs"] });
          }}
        />
      )}

      {/* Printable statement (thermal 80mm) */}
      {printRows && printClient && (
        <div className="thermal-receipt">
          <div style={{ textAlign: "center", fontWeight: 700 }}>
            {RESTAURANT}
          </div>
          <div style={{ textAlign: "center" }}>EXTRATO DE FIADO</div>
          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
          <div>Cliente: {printClient.full_name || "—"}</div>
          <div>Telefone: {printClient.phone || "—"}</div>
          <div>Emitido em: {new Date().toLocaleString("pt-BR")}</div>
          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
          {printRows.length === 0 ? (
            <div>Sem lançamentos.</div>
          ) : (
            printRows
              .slice()
              .reverse()
              .map((r) => (
                <div key={r.id} style={{ marginBottom: 3 }}>
                  <div>{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>
                      {r.tipo === "Debito_Compra" ? "Compra" : "Pagamento"}
                    </span>
                    <span>
                      {r.tipo === "Debito_Compra" ? "+" : "-"}
                      {formatBRL(r.valor)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    Saldo: {formatBRL(r.saldo_devedor_momento)}
                  </div>
                </div>
              ))
          )}
          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
            }}
          >
            <span>SALDO DEVEDOR</span>
            <span>{formatBRL(printClient.saldo_devedor_fiado)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientRow({
  client,
  onPay,
  onExtrato,
}: {
  client: FiadoClient;
  onPay: () => void;
  onExtrato: () => void;
}) {
  const queryClient = useQueryClient();
  const [autorizado, setAutorizado] = useState(client.fiado_autorizado);
  const [limite, setLimite] = useState(String(client.limite_fiado));
  const [saving, setSaving] = useState(false);

  const disponivel = Math.max(
    0,
    client.limite_fiado - client.saldo_devedor_fiado,
  );
  const dirty =
    autorizado !== client.fiado_autorizado ||
    Number(limite.replace(",", ".")) !== client.limite_fiado;

  async function handleSave() {
    const lim = Number(limite.replace(",", "."));
    if (Number.isNaN(lim) || lim < 0) {
      toast.error("Limite inválido.");
      return;
    }
    setSaving(true);
    try {
      await setFiadoConfig({ userId: client.id, autorizado, limite: lim });
      await queryClient.invalidateQueries({ queryKey: ["fiado-clients"] });
      toast.success("Configuração de fiado salva.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight">
            {client.full_name || "Cliente sem nome"}
          </p>
          <p className="text-xs text-muted-foreground">
            {client.phone || "sem telefone"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Saldo devedor
          </p>
          <p
            className={`font-display text-lg font-bold tabular-nums ${
              client.saldo_devedor_fiado > 0
                ? "text-destructive"
                : "text-success"
            }`}
          >
            {formatBRL(client.saldo_devedor_fiado)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={autorizado} onCheckedChange={setAutorizado} />
          <span>Autorizado</span>
        </label>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px]">Limite (R$)</Label>
          <Input
            inputMode="decimal"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className="h-9 rounded-lg"
          />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground">Disponível</span>
          <span className="font-semibold tabular-nums">
            {formatBRL(disponivel)}
          </span>
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground">Cashback</span>
          <span className="font-semibold tabular-nums text-primary">
            {formatBRL(client.saldo_cashback)}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Salvar
        </Button>
        <Button
          size="sm"
          className="rounded-full"
          disabled={client.saldo_devedor_fiado <= 0}
          onClick={onPay}
        >
          <HandCoins className="mr-1.5 h-4 w-4" /> Registrar pagamento
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={onExtrato}
        >
          <Printer className="mr-1.5 h-4 w-4" /> Extrato
        </Button>
      </div>
    </div>
  );
}

interface PayLine {
  meioId: string;
  meioNome: string;
  valor: number;
}

function PayDialog({
  client,
  open,
  onOpenChange,
  onPaid,
}: {
  client: FiadoClient;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPaid: () => void;
}) {
  const { data: meios } = useQuery({
    queryKey: ["meios-pagamento"],
    queryFn: () => fetchMeiosPagamento(true),
    enabled: open,
  });
  // Cannot pay a fiado debt with fiado/cashback methods.
  const payableMeios = useMemo(
    () => (meios ?? []).filter((m) => m.nome !== "Fiado"),
    [meios],
  );

  const [lines, setLines] = useState<PayLine[]>([]);
  const [meioId, setMeioId] = useState("");
  const [valor, setValor] = useState("");
  const [busy, setBusy] = useState(false);

  const totalLines = lines.reduce((s, l) => s + l.valor, 0);
  const devedorCents = toCents(client.saldo_devedor_fiado);
  const lancadoCents = toCents(totalLines);
  const excede = lancadoCents > devedorCents;

  function addLine() {
    const v = Number(valor.replace(",", "."));
    if (Number.isNaN(v) || v <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    const meio = payableMeios.find((m) => m.id === meioId) ?? payableMeios[0];
    if (!meio) return;
    setLines((prev) => [
      ...prev,
      { meioId: meio.id, meioNome: meio.nome, valor: v },
    ]);
    setValor("");
  }

  function fillRemaining() {
    const rem = (devedorCents - lancadoCents) / 100;
    if (rem > 0) setValor(rem.toFixed(2));
  }

  async function confirm() {
    if (lines.length === 0) {
      toast.error("Adicione ao menos um pagamento.");
      return;
    }
    if (excede) {
      toast.error("O valor lançado excede o saldo devedor.");
      return;
    }
    setBusy(true);
    try {
      for (const l of lines) {
        await payFiado({
          userId: client.id,
          valor: l.valor,
          meioId: l.meioId,
          descricao: `Quitação de fiado — ${client.full_name}`,
        });
      }
      toast.success("Pagamento de fiado registrado.");
      onPaid();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Pagamento de fiado · {client.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-secondary p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo devedor</span>
              <span className="font-bold tabular-nums text-destructive">
                {formatBRL(client.saldo_devedor_fiado)}
              </span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <Label>Adicionar pagamento</Label>
            <div className="flex gap-2">
              <select
                value={meioId}
                onChange={(e) => setMeioId(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
              >
                {payableMeios.map((m) => (
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
              <Button onClick={addLine} size="icon" className="h-10 w-10 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <button
              onClick={fillRemaining}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Preencher restante
            </button>
          </div>

          <div className="space-y-2">
            {lines.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Nenhum pagamento adicionado.
              </p>
            ) : (
              lines.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  <span className="font-medium">{l.meioNome}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatBRL(l.valor)}
                    </span>
                    <button
                      onClick={() =>
                        setLines((prev) => prev.filter((_, idx) => idx !== i))
                      }
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

          <div className="flex justify-between rounded-xl bg-card p-3 font-display font-bold shadow-card">
            <span>Total a pagar</span>
            <span
              className={`tabular-nums ${excede ? "text-destructive" : ""}`}
            >
              {formatBRL(totalLines)}
            </span>
          </div>
          {excede && (
            <p className="text-xs text-destructive">
              O valor lançado excede o saldo devedor.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={confirm}
            disabled={busy || lines.length === 0 || excede}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <HandCoins className="mr-2 h-4 w-4" />
            )}
            Confirmar quitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
