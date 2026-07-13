import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ShieldCheck, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchNiveis,
  createNivel,
  renameNivel,
  deleteNivel,
  setFlag,
  setAdminLocal,
  applyMatrizPreset,
  type NivelComMatriz,
} from "@/lib/niveis";
import { PERMISSION_LABELS, type PermissionFlag } from "@/lib/permissions";
import { CARGO_PRESETS, CUSTOM_PRESET_ID } from "@/lib/cargos";
import { Crown } from "lucide-react";

export function PermissoesTab() {
  const qc = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [preset, setPreset] = useState<string>(CUSTOM_PRESET_ID);
  const [saving, setSaving] = useState(false);

  const { data: niveis, isLoading } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: fetchNiveis,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
    qc.invalidateQueries({ queryKey: ["my-permissions"] });
  };

  const handlePresetChange = (id: string) => {
    setPreset(id);
    const p = CARGO_PRESETS.find((c) => c.id === id);
    // Preenche o nome sugerido quando o campo está vazio ou casava com outro preset.
    if (p && (!novoNome.trim() || CARGO_PRESETS.some((c) => c.nome === novoNome.trim()))) {
      setNovoNome(p.nome);
    }
  };

  const handleCreate = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setSaving(true);
    try {
      const id = await createNivel(nome);
      const chosen = CARGO_PRESETS.find((c) => c.id === preset);
      if (chosen) await applyMatrizPreset(id, chosen.flags);
      setNovoNome("");
      setPreset(CUSTOM_PRESET_ID);
      toast.success(chosen ? `Cargo "${chosen.nome}" criado.` : "Nível criado.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o nível.");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id: string, nome: string) => {
    try {
      await renameNivel(id, nome);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao renomear.");
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir o nível "${nome}"? Funcionários vinculados ficarão sem nível.`)) return;
    try {
      await deleteNivel(id);
      toast.success("Nível excluído.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const handleToggle = async (nivel_id: string, flag: PermissionFlag, value: boolean) => {
    // Optimistic update.
    qc.setQueryData<NivelComMatriz[]>(["niveis-acesso"], (prev) =>
      (prev ?? []).map((n) =>
        n.id === nivel_id ? { ...n, matriz: { ...n.matriz, [flag]: value } } : n,
      ),
    );
    try {
      await setFlag(nivel_id, flag, value);
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar permissão.");
      invalidate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const atLimit = (niveis?.length ?? 0) >= 10;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold">Níveis de Acesso</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie até 10 cargos customizáveis. Escolha um modelo pronto (Garçom, Cozinheiro,
          Financeiro…) para já ligar as permissões típicas — depois ajuste o que quiser. O
          administrador sempre tem acesso total.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Select value={preset} onValueChange={handlePresetChange} disabled={atLimit}>
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="Modelo de cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM_PRESET_ID}>Personalizado (vazio)</SelectItem>
              {CARGO_PRESETS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Nome do novo cargo"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            disabled={atLimit}
          />
          <Button onClick={handleCreate} disabled={saving || atLimit || !novoNome.trim()}>
            {saving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Adicionar
          </Button>
        </div>
        {atLimit && (
          <p className="mt-2 text-xs text-destructive">Limite de 10 níveis atingido.</p>
        )}
      </div>

      {(niveis ?? []).length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum nível cadastrado ainda.
        </p>
      )}

      <div className="space-y-4">
        {(niveis ?? []).map((n) => (
          <div key={n.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Input
                defaultValue={n.nome_nivel}
                className="max-w-xs font-semibold"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== n.nome_nivel) handleRename(n.id, v);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto text-destructive"
                onClick={() => handleDelete(n.id, n.nome_nivel)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {PERMISSION_LABELS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={n.matriz[key]}
                    onCheckedChange={(v) => handleToggle(n.id, key, v)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
