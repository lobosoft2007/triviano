import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Lock, LockOpen, Plus, Trash2, UserCog } from "lucide-react";
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
import { fetchNiveis, fetchFuncionarios, setFuncionarioNivel, setFuncionarioBloqueado } from "@/lib/niveis";
import { createFuncionario, deleteFuncionario } from "@/lib/funcionarios.functions";

export function FuncionariosTab() {
  const qc = useQueryClient();
  const createFn = useServerFn(createFuncionario);
  const deleteFn = useServerFn(deleteFuncionario);

  const [form, setForm] = useState({ full_name: "", email: "", password: "", nivel_id: "" });
  const [saving, setSaving] = useState(false);

  const { data: niveis } = useQuery({ queryKey: ["niveis-acesso"], queryFn: fetchNiveis });
  const { data: funcionarios, isLoading } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: fetchFuncionarios,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["funcionarios"] });

  const handleCreate = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password || !form.nivel_id) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setSaving(true);
    try {
      await createFn({ data: form });
      toast.success("Funcionário criado.");
      setForm({ full_name: "", email: "", password: "", nivel_id: "" });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o funcionário.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeNivel = async (user_id: string, nivel_id: string) => {
    try {
      await setFuncionarioNivel(user_id, nivel_id);
      toast.success("Nível atualizado.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar o nível.");
    }
  };

  const handleDelete = async (user_id: string, nome: string | null) => {
    if (!confirm(`Excluir o funcionário "${nome ?? "sem nome"}"? Esta ação é permanente.`)) return;
    try {
      await deleteFn({ data: { user_id } });
      toast.success("Funcionário removido.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover.");
    }
  };

  const noLevels = (niveis ?? []).length === 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold">Novo Funcionário</h2>
        </div>
        {noLevels ? (
          <p className="mt-2 text-sm text-destructive">
            Crie ao menos um nível de acesso na aba Permissões antes de cadastrar funcionários.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Nível de acesso</Label>
              <Select
                value={form.nivel_id}
                onValueChange={(v) => setForm((f) => ({ ...f, nivel_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(niveis ?? []).map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.nome_nivel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Cadastrar funcionário
              </Button>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (funcionarios ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum funcionário cadastrado.
        </p>
      ) : (
        <div className="space-y-2">
          {(funcionarios ?? []).map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="min-w-40 flex-1 font-semibold">{f.full_name ?? "—"}</span>
              <Select
                value={f.nivel_id ?? ""}
                onValueChange={(v) => handleChangeNivel(f.id, v)}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Sem nível" />
                </SelectTrigger>
                <SelectContent>
                  {(niveis ?? []).map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.nome_nivel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => handleDelete(f.id, f.full_name)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
