import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { QrCode, Loader2, Printer, Copy, Armchair } from "lucide-react";
import { empresaQueryOptions } from "@/lib/empresa";
import { mesaTokenFor, buildMesaQrUrl } from "@/lib/mesa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MesaQr {
  numero: number;
  url: string;
  dataUrl: string;
}

const MAX_MESAS = 60;

export function MesasQrTab() {
  const { data: empresa } = useQuery(empresaQueryOptions);
  const [quantidade, setQuantidade] = useState("12");
  const [mesas, setMesas] = useState<MesaQr[]>([]);
  const [loading, setLoading] = useState(false);

  async function gerar() {
    const empresaId = empresa?.id;
    if (!empresaId) {
      toast.error("Empresa não carregada. Recarregue a página.");
      return;
    }
    const n = Math.min(MAX_MESAS, Math.max(1, Math.floor(Number(quantidade) || 0)));
    setLoading(true);
    try {
      const out: MesaQr[] = [];
      for (let i = 1; i <= n; i++) {
        const token = await mesaTokenFor(empresaId, i);
        const url = buildMesaQrUrl(i, token);
        const dataUrl = await QRCode.toDataURL(url, { width: 420, margin: 1 });
        out.push({ numero: i, url, dataUrl });
      }
      setMesas(out);
      toast.success(`${n} QR-Code${n > 1 ? "s" : ""} gerado${n > 1 ? "s" : ""}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao gerar os QR-Codes.",
      );
    } finally {
      setLoading(false);
    }
  }

  function copiar(url: string, numero: number) {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success(`Link da mesa ${numero} copiado.`))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  function imprimirTodas() {
    if (mesas.length === 0) return;
    const nome = empresa?.nome_fantasia ?? "Cardápio";
    const cards = mesas
      .map(
        (m) => `
        <div class="card">
          <div class="title">${nome}</div>
          <div class="mesa">Mesa ${m.numero}</div>
          <img src="${m.dataUrl}" alt="QR mesa ${m.numero}" />
          <div class="hint">Aponte a câmera para pedir</div>
        </div>`,
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR das Mesas</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; margin: 0; padding: 12px; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .card { border: 1px solid #ccc; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
        .title { font-size: 14px; font-weight: 700; }
        .mesa { font-size: 26px; font-weight: 800; margin: 6px 0; }
        .card img { width: 78%; height: auto; }
        .hint { font-size: 12px; color: #555; margin-top: 6px; }
        @media print { .card { border-color: #000; } }
      </style></head>
      <body><div class="grid">${cards}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Permita pop-ups para imprimir.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Armchair className="h-6 w-6 text-primary" />
          Mesas — QR-Codes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere os QR-Codes seguros das mesas. Cada código já vem assinado com o
          segredo da sua empresa — só é válido no seu endereço.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="w-40">
          <Label htmlFor="qtd-mesas">Quantidade de mesas</Label>
          <Input
            id="qtd-mesas"
            type="number"
            min={1}
            max={MAX_MESAS}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="mt-1 h-11 rounded-xl"
          />
        </div>
        <Button onClick={gerar} disabled={loading} className="h-11 gap-2 rounded-xl">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <QrCode className="h-4 w-4" />
          )}
          Gerar QR-Codes
        </Button>
        {mesas.length > 0 && (
          <Button
            variant="outline"
            onClick={imprimirTodas}
            className="h-11 gap-2 rounded-xl"
          >
            <Printer className="h-4 w-4" />
            Imprimir todas
          </Button>
        )}
      </div>

      {mesas.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {mesas.map((m) => (
            <div
              key={m.numero}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-card"
            >
              <span className="font-display text-sm font-bold">
                Mesa {m.numero}
              </span>
              <img
                src={m.dataUrl}
                alt={`QR da mesa ${m.numero}`}
                className="aspect-square w-full rounded-lg bg-white p-1"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-full gap-1.5 rounded-lg text-xs"
                onClick={() => copiar(m.url, m.numero)}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar link
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
