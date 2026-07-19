import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Plus, Smartphone, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listPosDevices,
  generatePosPairCode,
  revokePosDevice,
  setOperatorPin,
  type PosFlavor,
} from "@/lib/pos";
import { fetchFuncionarios } from "@/lib/niveis";
import { PosAppBrandingSection } from "@/components/admin/PosAppBrandingSection";

const FLAVORS: { value: PosFlavor; label: string }[] = [
  { value: "rede", label: "Rede Smart" },
  { value: "pagseguro", label: "PagSeguro / Moderninha Smart" },
  { value: "infinitepay", label: "InfinitePay Smart" },
];

const flavorLabel = (f: PosFlavor) =>
  FLAVORS.find((x) => x.value === f)?.label ?? f;

export function PosDevicesTab() {
  const qc = useQueryClient();

  const devicesQ = useQuery({
    queryKey: ["pos-devices"],
    queryFn: listPosDevices,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });


  const funcsQ = useQuery({
    queryKey: ["funcionarios-pin"],
    queryFn: fetchFuncionarios,
  });

  const [pairOpen, setPairOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [flavor, setFlavor] = useState<PosFlavor>("infinitepay");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const genMut = useMutation({
    mutationFn: () => generatePosPairCode(nome.trim(), flavor),
    onSuccess: (code) => {
      setGeneratedCode(code);
      qc.invalidateQueries({ queryKey: ["pos-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: revokePosDevice,
    onSuccess: () => {
      toast.success("Maquininha revogada.");
      qc.invalidateQueries({ queryKey: ["pos-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- PIN ----------
  const [pinOpen, setPinOpen] = useState(false);
  const [pinUser, setPinUser] = useState<{ id: string; name: string } | null>(null);
  const [pinValue, setPinValue] = useState("");

  const pinMut = useMutation({
    mutationFn: () => setOperatorPin(pinUser!.id, pinValue),
    onSuccess: () => {
      toast.success("PIN definido.");
      setPinOpen(false);
      setPinValue("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openPinDialog(id: string, name: string) {
    setPinUser({ id, name });
    setPinValue("");
    setPinOpen(true);
  }

  function closePairDialog() {
    setPairOpen(false);
    setGeneratedCode(null);
    setNome("");
  }

  return (
    <div className="space-y-8">
      {/* ==================== APP BRANDING ==================== */}
      <PosAppBrandingSection />

      {/* ==================== MAQUININHAS ==================== */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Maquininhas (Smart POS)</h2>
            <p className="text-sm text-muted-foreground">
              Pareie o aplicativo Triviano Garçom instalado na maquininha da adquirente.
            </p>
          </div>
          <Button size="sm" onClick={() => setPairOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Parear nova
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {devicesQ.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (devicesQ.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Smartphone className="h-6 w-6" />
              Nenhuma maquininha pareada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Última atividade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(devicesQ.data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nome}</TableCell>
                    <TableCell>{flavorLabel(d.flavor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.last_seen_at
                        ? new Date(d.last_seen_at).toLocaleString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {d.revogado_em ? (
                        <span className="text-xs font-semibold text-destructive">Revogada</span>
                      ) : (
                        <span className="text-xs font-semibold text-primary">Ativa</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!d.revogado_em && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Revogar esta maquininha? Ela precisará ser pareada de novo.")) {
                              revokeMut.mutate(d.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* ==================== PINS DE OPERADOR ==================== */}
      <section>
        <div className="mb-4">
          <h2 className="font-display text-lg font-bold">PIN dos garçons</h2>
          <p className="text-sm text-muted-foreground">
            Cada funcionário precisa de um PIN numérico (4 a 8 dígitos) para entrar no
            aplicativo da maquininha. O PIN nunca é exibido — apenas redefinido.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {funcsQ.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (funcsQ.data ?? []).filter((f) => f.nivel_id).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum funcionário cadastrado. Cadastre em <b>Funcionários</b> primeiro.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(funcsQ.data ?? [])
                  .filter((f) => f.nivel_id)
                  .map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.full_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.nome_nivel || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openPinDialog(f.id, f.full_name || "funcionário")}
                        >
                          <KeyRound className="mr-1 h-4 w-4" /> Definir PIN
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* ==================== DIALOG: PAREAR ==================== */}
      <Dialog open={pairOpen} onOpenChange={(o) => (o ? setPairOpen(true) : closePairDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parear nova maquininha</DialogTitle>
            <DialogDescription>
              Gere um código de uso único e digite-o na tela de pareamento do app instalado
              na maquininha. O código expira em 15 minutos.
            </DialogDescription>
          </DialogHeader>

          {!generatedCode ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="pos-nome">Nome de identificação</Label>
                <Input
                  id="pos-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Maquininha do salão 1"
                />
              </div>
              <div>
                <Label>Marca</Label>
                <Select value={flavor} onValueChange={(v) => setFlavor(v as PosFlavor)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLAVORS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Código de pareamento
              </p>
              <p className="my-3 font-mono text-4xl font-bold tracking-widest text-primary">
                {generatedCode}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode).catch(() => {});
                  toast.success("Copiado.");
                }}
              >
                <Copy className="mr-1 h-4 w-4" /> Copiar
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Expira em 15 minutos. Uso único.
              </p>
            </div>
          )}

          <DialogFooter>
            {!generatedCode ? (
              <Button
                onClick={() => genMut.mutate()}
                disabled={!nome.trim() || genMut.isPending}
              >
                {genMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Gerar código
              </Button>
            ) : (
              <Button onClick={closePairDialog}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG: PIN ==================== */}
      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN de {pinUser?.name}</DialogTitle>
            <DialogDescription>
              Digite entre 4 e 8 dígitos numéricos. Esse PIN substitui qualquer PIN
              anterior deste funcionário.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="••••"
            className="text-center font-mono text-2xl tracking-widest"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPinOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => pinMut.mutate()}
              disabled={pinValue.length < 4 || pinMut.isPending}
            >
              {pinMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
