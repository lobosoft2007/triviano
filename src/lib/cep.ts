// Address auto-fill (ViaCEP) + background geocoding (Nominatim/OpenStreetMap).

export interface CepResult {
  tipo_logradouro: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  estado: string;
  ddd: string;
  cep: string;
}

const STREET_TYPES = [
  "Rua",
  "Avenida",
  "Travessa",
  "Alameda",
  "Praça",
  "Praca",
  "Rodovia",
  "Estrada",
  "Largo",
  "Viela",
  "Via",
  "Servidão",
  "Servidao",
  "Ladeira",
  "Beco",
  "Quadra",
  "Passarela",
  "Loteamento",
];

/** Splits a ViaCEP "logradouro" into a street type + street name. */
function splitLogradouro(raw: string): { tipo: string; nome: string } {
  const value = (raw ?? "").trim();
  if (!value) return { tipo: "", nome: "" };
  const firstSpace = value.indexOf(" ");
  const firstWord = firstSpace === -1 ? value : value.slice(0, firstSpace);
  const match = STREET_TYPES.find(
    (t) => t.toLowerCase() === firstWord.toLowerCase(),
  );
  if (match) {
    return { tipo: match, nome: value.slice(firstWord.length).trim() };
  }
  return { tipo: "", nome: value };
}

/** Normalizes a CEP to 8 digits (no mask). */
export function normalizeCep(cep: string): string {
  return (cep ?? "").replace(/\D/g, "").slice(0, 8);
}

/** Formats an 8-digit CEP as 00000-000. */
export function formatCep(cep: string): string {
  const d = normalizeCep(cep);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Looks up an address by CEP using the public ViaCEP API. */
export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = normalizeCep(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
      ddd?: string;
    };
    if (data.erro) return null;
    const { tipo, nome } = splitLogradouro(data.logradouro ?? "");
    return {
      tipo_logradouro: tipo,
      logradouro: nome,
      bairro: data.bairro ?? "",
      municipio: data.localidade ?? "",
      estado: data.uf ?? "",
      ddd: data.ddd ?? "",
      cep: digits,
    };
  } catch {
    return null;
  }
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Best-effort geocoding for lat/long from a structured address (background). */
export async function geocodeAddress(input: {
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  estado: string;
  cep: string;
}): Promise<GeoPoint | null> {
  const parts = [
    [input.logradouro, input.numero].filter(Boolean).join(", "),
    input.bairro,
    input.municipio,
    input.estado,
    input.cep,
    "Brasil",
  ]
    .filter((p) => p && p.trim())
    .join(", ");
  if (!parts) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(
      parts,
    )}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat?: string; lon?: string }[];
    const first = rows?.[0];
    if (!first?.lat || !first?.lon) return null;
    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  } catch {
    return null;
  }
}
