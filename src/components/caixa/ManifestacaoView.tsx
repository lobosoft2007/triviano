import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { consultarDFe, manifestarNFe } from "@/lib/fiscal";
import { empresaAdminConfigQueryOptions } from "@/lib/empresa";
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

const EVENTOS = [
  { value: "ciencia", label: "Ciência" },
  { value: "confirmacao", label: "Confirmação" },
  { value: "desconhecimento", label: "Desconhecimento" },
  { value: "opnr", label: "Operação Não Realizada" },
] as const;

export function ManifestacaoView() {
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery(empresaAdminConfigQueryOptions);
  const [cnpj, setCnpj] = useState(empresa?.cnpj ?? "");
  const [ultimoNsu, setUltimoNsu] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [documentos, setDocumentos] = useState<
    Awaited<ReturnType<typeof consultarDFe>>
  >([]);

  async function handleConsultar() {
    if (!empresa?.id || !cnpj.trim()) {
      toast.error("Informe o CNPJ da empresa.");
      return;
    }
    setConsultando(true);
    try {
      const docs = await consultarDFe({
        data: {
          empresa_id: empresa.id,
          cnpj: cnpj.trim().replace(/\D/g, ""),
          ultimo_nsu: ultimoNsu.trim() || undefined,
        },
      });
      setDocumentos(docs);
      if (docs.length === 0) toast.info("Nenhum documento encontrado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao consultar DFe.");
    } finally {
      setConsultando(false);
    }
  }

  async function handleManifestar(
    chave: string,
    tipo: (typeof EVENTOS)[number]["value"],
  ) {
    if (!empresa?.id) return;
    try {
      const res = await manifestarNFe({
        data: {
          empresa_id: empresa.id,
          chave_acesso: chave,
          tipo_evento: tipo,
        },
      });
      if (res.sucesso) {
        toast.success(`Manifestação registrada: ${tipo}`);
        await queryClient.invalidateQueries({ queryKey: ["manifestacoes"] });
      } else {
        toast.error(res.mensagem || "Erro ao manifestar.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao manifestar.");
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="mb-4 font-display text-base font-bold">
          Consulta de Documentos Fiscais (DFe)
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cnpj-consulta">CNPJ da empresa</Label>
            <Input
              id="cnpj-consulta"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nsu">Último NSU (opcional)</Label>
            <Input
              id="nsu"
              value={ultimoNsu}
              onChange={(e) => setUltimoNsu(e.target.value)}
              placeholder="000000000000000"
            />
          </div>
        </div>
        <Button
          onClick={handleConsultar}
          disabled={consultando}
          className="mt-4 w-full"
        >
          {consultando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Consultar NF-es emitidas contra o CNPJ
        </Button>
      </div>

      {documentos.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-base font-bold">
            Documentos encontrados
          </h3>
          {documentos.map((doc) => (
            <div
              key={doc.chave_acesso}
              className="rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="truncate">{doc.chave_acesso}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {doc.nome_emitente || doc.cnpj_emitente}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.data_emissao}
                    {doc.valor ? ` · R$ ${doc.valor.toFixed(2)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    onValueChange={(v) =>
                      handleManifestar(
                        doc.chave_acesso,
                        v as (typeof EVENTOS)[number]["value"],
                      )
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Manifestar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENTOS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {documentos.length === 0 && !consultando && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma NF-e de fornecedor consultada ainda.
          </p>
          <p className="text-xs text-muted-foreground">
            A consulta busca documentos emitidos contra o CNPJ da empresa na
            SEFAZ, via provedor fiscal configurado.
          </p>
        </div>
      )}
    </section>
  );
}
