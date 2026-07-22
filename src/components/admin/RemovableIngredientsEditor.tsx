import { useState } from "react";
import { Plus, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { FichaRow } from "@/components/admin/FichaTecnicaEditor";

/**
 * Editor da lista "Ingredientes que o cliente pode remover".
 *
 * Persiste em `ingredientes_produto.permitir_exclusao = true` (mesma coluna
 * que o PWA já lê para montar a seção "Deseja remover algum ingrediente?").
 */
export function RemovableIngredientsEditor({
  value,
  onChange,
  ficha,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Ficha técnica atual — usada pelo botão "Importar da Ficha Técnica". */
  ficha: FichaRow[];
}) {
  const [novo, setNovo] = useState("");

  const dedupePush = (nome: string) => {
    const clean = nome.trim();
    if (!clean) return;
    const jaExiste = value.some(
      (n) => n.trim().toLowerCase() === clean.toLowerCase(),
    );
    if (jaExiste) return;
    onChange([...value, clean]);
  };

  const add = () => {
    dedupePush(novo);
    setNovo("");
  };

  const remove = (idx: number) =>
    onChange(value.filter((_, i) => i !== idx));

  const importFromFicha = () => {
    const nomes = Array.from(
      new Set(
        ficha
          .map((f) => f.nome?.trim() ?? "")
          .filter((n) => n.length > 0),
      ),
    );
    if (!nomes.length) return;
    const next = [...value];
    for (const nome of nomes) {
      const jaExiste = next.some(
        (n) => n.trim().toLowerCase() === nome.toLowerCase(),
      );
      if (!jaExiste) next.push(nome);
    }
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold">
          Ingredientes que o cliente pode remover
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={importFromFicha}
          disabled={ficha.length === 0}
          title="Preenche a lista com os itens da Ficha Técnica"
        >
          <Download className="mr-1 h-4 w-4" /> Importar da Ficha
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Ex.: Tomate, Cebola, Picles. O cliente verá&nbsp;
        <span className="font-semibold">"Sem tomate"</span> ao personalizar o
        pedido no PWA.
      </p>

      <div className="mb-3 flex items-center gap-2">
        <Input
          className="h-9 flex-1"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Digite um ingrediente e pressione Enter"
        />
        <Button type="button" size="sm" onClick={add} disabled={!novo.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          Nenhum ingrediente removível cadastrado.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((nome, idx) => (
            <span
              key={`${nome}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary py-1 pl-3 pr-1.5 text-xs font-medium"
            >
              {nome}
              <button
                type="button"
                aria-label={`Remover ${nome}`}
                onClick={() => remove(idx)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
