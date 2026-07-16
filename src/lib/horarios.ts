import { supabase } from "@/integrations/supabase/client";

export interface Horario {
  id?: string;
  dia_semana: number; // 0..6
  hora_inicio: string; // "HH:MM" ou "HH:MM:SS"
  hora_fim: string;
}

export const DIAS_SEMANA: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

/** Carrega janelas de uma categoria (ordenadas por dia/hora). */
export async function listCategoryHorarios(
  categoria_id: string,
): Promise<Horario[]> {
  const { data, error } = await supabase
    .from("category_horarios" as never)
    .select("id, dia_semana, hora_inicio, hora_fim")
    .eq("categoria_id", categoria_id)
    .order("dia_semana")
    .order("hora_inicio");
  if (error) throw error;
  return ((data ?? []) as unknown as Horario[]).map((h) => ({
    id: h.id,
    dia_semana: Number(h.dia_semana),
    hora_inicio: String(h.hora_inicio).slice(0, 5),
    hora_fim: String(h.hora_fim).slice(0, 5),
  }));
}

/** Substitui todas as janelas de uma categoria (delete + insert atômico). */
export async function saveCategoryHorarios(
  categoria_id: string,
  horarios: Horario[],
): Promise<void> {
  const payload = horarios.map((h) => ({
    dia_semana: h.dia_semana,
    hora_inicio: h.hora_inicio.length === 5 ? `${h.hora_inicio}:00` : h.hora_inicio,
    hora_fim: h.hora_fim.length === 5 ? `${h.hora_fim}:00` : h.hora_fim,
  }));
  const { error } = await supabase.rpc("admin_set_category_horarios" as never, {
    p_categoria_id: categoria_id,
    p_horarios: payload,
  } as never);
  if (error) throw error;
}
