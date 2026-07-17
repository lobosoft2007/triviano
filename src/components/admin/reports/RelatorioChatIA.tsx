import { useRef, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  generateReportSpec,
  type ChatMessage,
} from "@/lib/reports/reports-ai.functions";
import {
  createRelatorioSalvo,
  deleteRelatorioSalvo,
  listRelatoriosSalvos,
} from "@/lib/reports/reports.functions";
import { empresaAdminConfigQueryOptions } from "@/lib/empresa";
import type { ReportSpec } from "@/lib/reports/spec";
import { ReportSpecRunner } from "./ReportSpecRunner";

export function RelatorioChatIA() {
  const generate = useServerFn(generateReportSpec);
  const create = useServerFn(createRelatorioSalvo);
  const remove = useServerFn(deleteRelatorioSalvo);
  const list = useServerFn(listRelatoriosSalvos);
  const qc = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [spec, setSpec] = useState<ReportSpec | null>(null);
  const [name, setName] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    composerRef.current?.focus();
  }, []);

  const saved = useQuery({
    queryKey: ["relatorios-salvos"],
    queryFn: () => list(),
  });

  const generateMutation = useMutation({
    mutationFn: async (text: string) => {
      const history: ChatMessage[] = messages;
      const result = await generate({ data: { prompt: text, history } });
      return { text, result };
    },
    onSuccess: ({ text, result }) => {
      const assistant: string = result.clarify
        ? result.clarify
        : result.spec
          ? `Pronto! Gerei o relatório "${result.spec.title}" (${result.spec.dataSource}). Ajuste ao lado ou peça mudanças.`
          : "Não consegui interpretar a solicitação. Pode reformular?";
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: assistant },
      ]);
      if (result.spec) setSpec(result.spec);
      setPrompt("");
      composerRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!spec) throw new Error("Nenhum relatório para salvar.");
      if (!name.trim()) throw new Error("Dê um nome ao relatório.");
      return await create({ data: { nome: name.trim(), spec } });
    },
    onSuccess: () => {
      toast.success("Relatório salvo!");
      setName("");
      qc.invalidateQueries({ queryKey: ["relatorios-salvos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relatorios-salvos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = () => {
    const t = prompt.trim();
    if (!t || generateMutation.isPending) return;
    generateMutation.mutate(t);
  };

  return (
    <div className="grid h-full min-h-[600px] gap-4 lg:grid-cols-[380px_1fr]">
      {/* Chat panel */}
      <div className="flex flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Assistente de Relatórios</h3>
        </div>
        <ScrollArea className="flex-1 p-3">
          {messages.length === 0 ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Descreva o relatório que você precisa em linguagem natural.</p>
              <p className="text-xs">Exemplos:</p>
              <ul className="ml-4 list-disc text-xs">
                <li>Clientes com saldo devedor maior que 50 reais</li>
                <li>Vendas por bairro no último mês, gráfico de barras</li>
                <li>Produtos ativos com estoque abaixo de 10 unidades</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-6 rounded-lg bg-primary/10 px-3 py-2 text-sm"
                      : "mr-6 text-sm text-foreground"
                  }
                >
                  {m.content}
                </div>
              ))}
              {generateMutation.isPending ? (
                <div className="mr-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
                </div>
              ) : null}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-border p-3">
          <Textarea
            ref={composerRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex.: vendas do último mês agrupadas por canal"
            rows={3}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleSend}
              disabled={generateMutation.isPending || !prompt.trim()}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </div>

        {/* Saved reports list */}
        <div className="border-t border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Meus relatórios
          </p>
          {saved.isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (saved.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum salvo ainda.</p>
          ) : (
            <ul className="space-y-1">
              {(saved.data ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs"
                >
                  <button
                    className="flex-1 text-left hover:underline"
                    onClick={() => setSpec(r.spec)}
                  >
                    {r.nome}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(r.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Preview panel */}
      <div className="min-h-[600px] rounded-xl border border-border bg-background p-4">
        {spec ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome para salvar este relatório"
                className="h-9 max-w-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !name.trim()}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            <ReportSpecRunner spec={spec} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              O relatório gerado pela IA aparecerá aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
