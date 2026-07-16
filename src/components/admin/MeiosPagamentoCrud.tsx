import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CreditCard, Plus, Trash2, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMeiosPagamento,
  createMeioPagamento,
  updateMeioPagamento,
  deleteMeioPagamento,
  type MeioPagamento,
} from "@/lib/caixa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * CRUD para meios de pagamento da empresa. Meios "de sistema" (PIX, Dinheiro,
 * Cashback, Fiado, Cartão de Crédito, Cartão de Débito) não podem ser
 * excluídos — apenas desativados. Meios criados pelo usuário podem ser
 * removidos se não tiverem uso em pagamentos ou contas financeiras.
 */
export function MeiosPagamentoCrud() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["meios-pagamento-crud"],
    queryFn: () => fetchMeiosPagamento(false),
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["meios-pagamento-crud"] });
    queryClient.invalidateQueries({ queryKey: ["meios-cashback"] });
    queryClient.invalidateQueries({ queryKey: ["meios-pagamento"] });
  }

  return (
    <section className="mt-8 w-full">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">
              Meios de pagamento
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre e mantenha os meios aceitos pela sua empresa (PIX,
            Dinheiro, Cartões, Fiado, Vale Alimentação, Vale Refeição…). Os
            meios ativos aparecem automaticamente no Caixa e no bloco de
            cashback abaixo.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 rounded-full"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhum meio cadastrado. Clique em “Novo” para começar.
        </p>
      ) : (
        <div className="space-y-3">
          {data!.map((m) => (
            <MeioRow key={m.id} meio={m} onChanged={refetch} />
          ))}
        </div>
      )}

      <NewMeioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refetch}
      />
    </section>
  );
}

function MeioRow({
  meio,
  onChanged,
}: {
  meio: MeioPagamento;
  onChanged: () => void;
}) {
  const [nome, setNome] = useState(meio.nome);
  const [ativo, setAtivo] = useState(meio.ativo);
  const [maquineta, setMaquineta] = useState(meio.exige_maquineta);
  const [pct, setPct] = useState(String(meio.percentual_cashback));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setNome(meio.nome);
    setAtivo(meio.ativo);
    setMaquineta(meio.exige_maquineta);
    setPct(String(meio.percentual_cashback));
  }, [meio.id, meio.nome, meio.ativo, meio.exige_maquineta, meio.percentual_cashback]);

  const parsedPct = Number(pct.replace(",", "."));
  const dirty =
    nome.trim() !== meio.nome ||
    ativo !== meio.ativo ||
    maquineta !== meio.exige_maquineta ||
    (Number.isFinite(parsedPct) && parsedPct !== meio.percentual_cashback);

  async function handleSave() {
    if (!nome.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    if (!Number.isFinite(parsedPct) || parsedPct < 0 || parsedPct > 100) {
      toast.error("Cashback deve ser entre 0 e 100.");
      return;
    }
    setSaving(true);
    try {
      await updateMeioPagamento(meio.id, {
        nome: meio.is_sistema ? undefined : nome,
        ativo,
        exige_maquineta: maquineta,
        percentual_cashback: parsedPct,
      });
      toast.success(`${nome} atualizado.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMeioPagamento(meio.id);
      toast.success(`${meio.nome} excluído.`);
      setConfirmDelete(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={meio.is_sistema}
              className="h-9 rounded-lg"
            />
            {meio.is_sistema && (
              <span
                title="Meio do sistema (não pode ser renomeado nem excluído)"
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                <Lock className="h-3 w-3" /> sistema
              </span>
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Cashback</Label>
          <div className="relative mt-1">
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
        </div>

        <div className="flex flex-col items-start gap-1">
          <Label className="text-xs text-muted-foreground">Ativo</Label>
          <Switch checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="flex flex-col items-start gap-1">
          <Label className="text-xs text-muted-foreground">Maquineta</Label>
          <Switch checked={maquineta} onCheckedChange={setMaquineta} />
        </div>

        <div className="ml-auto flex items-center gap-2">
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
              <>
                <Save className="mr-1 h-4 w-4" /> Salvar
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            disabled={meio.is_sistema}
            title={
              meio.is_sistema
                ? "Meios do sistema só podem ser desativados."
                : "Excluir"
            }
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {meio.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O meio só será excluído se nunca tiver sido usado em pagamentos
              ou vinculado a uma conta financeira. Caso contrário, prefira
              desativá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewMeioDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [pct, setPct] = useState("0");
  const [ativo, setAtivo] = useState(true);
  const [maquineta, setMaquineta] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome("");
      setPct("0");
      setAtivo(true);
      setMaquineta(false);
    }
  }, [open]);

  async function handleCreate() {
    const parsedPct = Number(pct.replace(",", "."));
    if (!nome.trim()) {
      toast.error("Informe o nome do meio.");
      return;
    }
    if (!Number.isFinite(parsedPct) || parsedPct < 0 || parsedPct > 100) {
      toast.error("Cashback deve ser entre 0 e 100.");
      return;
    }
    setSaving(true);
    try {
      await createMeioPagamento({
        nome,
        percentual_cashback: parsedPct,
        ativo,
        exige_maquineta: maquineta,
      });
      toast.success(`${nome.trim()} cadastrado.`);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar.";
      toast.error(
        /duplicate|unique/i.test(msg)
          ? "Já existe um meio com esse nome."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo meio de pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Vale Alimentação"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Cashback (%)</Label>
            <Input
              inputMode="decimal"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="mt-1 w-32 tabular-nums"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Só meios ativos aparecem no Caixa.
              </p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="font-medium">Exige maquineta</p>
              <p className="text-xs text-muted-foreground">
                Marque para cartões / TEF.
              </p>
            </div>
            <Switch checked={maquineta} onCheckedChange={setMaquineta} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Cadastrar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
