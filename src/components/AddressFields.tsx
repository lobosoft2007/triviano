import { useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCep, normalizeCep, formatCep } from "@/lib/cep";

export interface AddressState {
  cep: string;
  tipo_logradouro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  estado: string;
  ddd: string;
  telefone: string;
}

export const emptyAddress: AddressState = {
  cep: "",
  tipo_logradouro: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  estado: "",
  ddd: "",
  telefone: "",
};

export function AddressFields({
  value,
  onChange,
}: {
  value: AddressState;
  onChange: (next: AddressState) => void;
}) {
  const [loadingCep, setLoadingCep] = useState(false);

  function set<K extends keyof AddressState>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  async function runLookup(rawCep: string) {
    const digits = normalizeCep(rawCep);
    if (digits.length !== 8) return;
    setLoadingCep(true);
    const result = await lookupCep(digits);
    setLoadingCep(false);
    if (!result) {
      toast.error("CEP não encontrado. Preencha o endereço manualmente.");
      return;
    }
    onChange({
      ...value,
      cep: digits,
      tipo_logradouro: result.tipo_logradouro || value.tipo_logradouro,
      logradouro: result.logradouro || value.logradouro,
      bairro: result.bairro || value.bairro,
      municipio: result.municipio || value.municipio,
      estado: result.estado || value.estado,
      ddd: result.ddd || value.ddd,
    });
    toast.success("Endereço preenchido pelo CEP.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cep">CEP</Label>
        <div className="relative">
          <Input
            id="cep"
            inputMode="numeric"
            placeholder="00000-000"
            className="h-12 rounded-xl pr-10"
            value={formatCep(value.cep)}
            onChange={(e) => {
              const digits = normalizeCep(e.target.value);
              set("cep", digits);
              if (digits.length === 8) void runLookup(digits);
            }}
            onBlur={(e) => void runLookup(e.target.value)}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {loadingCep ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 flex flex-col gap-1.5">
          <Label htmlFor="tipo_logradouro">Tipo</Label>
          <Input
            id="tipo_logradouro"
            placeholder="Rua"
            className="h-12 rounded-xl"
            value={value.tipo_logradouro}
            onChange={(e) => set("tipo_logradouro", e.target.value)}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="logradouro">Logradouro</Label>
          <Input
            id="logradouro"
            placeholder="Nome da rua"
            className="h-12 rounded-xl"
            value={value.logradouro}
            onChange={(e) => set("logradouro", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 flex flex-col gap-1.5">
          <Label htmlFor="numero">Número</Label>
          <Input
            id="numero"
            placeholder="123"
            className="h-12 rounded-xl"
            value={value.numero}
            onChange={(e) => set("numero", e.target.value)}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="complemento">Complemento</Label>
          <Input
            id="complemento"
            placeholder="Apto, bloco (opcional)"
            className="h-12 rounded-xl"
            value={value.complemento}
            onChange={(e) => set("complemento", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bairro">Bairro</Label>
        <Input
          id="bairro"
          placeholder="Bairro"
          className="h-12 rounded-xl"
          value={value.bairro}
          onChange={(e) => set("bairro", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="municipio">Município</Label>
          <Input
            id="municipio"
            placeholder="Cidade"
            className="h-12 rounded-xl"
            value={value.municipio}
            onChange={(e) => set("municipio", e.target.value)}
          />
        </div>
        <div className="col-span-1 flex flex-col gap-1.5">
          <Label htmlFor="estado">UF</Label>
          <Input
            id="estado"
            placeholder="SP"
            maxLength={2}
            className="h-12 rounded-xl uppercase"
            value={value.estado}
            onChange={(e) => set("estado", e.target.value.toUpperCase())}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 flex flex-col gap-1.5">
          <Label htmlFor="ddd">DDD</Label>
          <Input
            id="ddd"
            inputMode="numeric"
            placeholder="11"
            maxLength={3}
            className="h-12 rounded-xl"
            value={value.ddd}
            onChange={(e) => set("ddd", e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            inputMode="numeric"
            placeholder="99999-9999"
            className="h-12 rounded-xl"
            value={value.telefone}
            onChange={(e) => set("telefone", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
