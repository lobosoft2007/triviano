/**
 * Oculta notificações do sino do PWA apenas no lado do cliente (per-device).
 * As linhas continuam no banco (auditoria/histórico); só somem da UI.
 * Entradas mais antigas que a janela visível (24h) são purgadas na leitura.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;

type HiddenEntry = { id: string; ts: number };

function storageKey(userId: string) {
  return `hidden-notifications:${userId}`;
}

function safeRead(userId: string): HiddenEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HiddenEntry =>
        !!e && typeof e.id === "string" && typeof e.ts === "number",
    );
  } catch {
    return [];
  }
}

function safeWrite(userId: string, entries: HiddenEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(entries));
  } catch {
    /* ignore quota */
  }
}

function purge(entries: HiddenEntry[]): HiddenEntry[] {
  const cutoff = Date.now() - WINDOW_MS;
  return entries.filter((e) => e.ts >= cutoff);
}

export function getHiddenIds(userId: string | undefined | null): Set<string> {
  if (!userId) return new Set();
  const kept = purge(safeRead(userId));
  safeWrite(userId, kept);
  return new Set(kept.map((e) => e.id));
}

export function hideNotification(
  userId: string | undefined | null,
  id: string,
) {
  if (!userId) return;
  const kept = purge(safeRead(userId));
  if (kept.some((e) => e.id === id)) return;
  kept.push({ id, ts: Date.now() });
  safeWrite(userId, kept);
}

export function hideNotifications(
  userId: string | undefined | null,
  ids: string[],
) {
  if (!userId || ids.length === 0) return;
  const kept = purge(safeRead(userId));
  const existing = new Set(kept.map((e) => e.id));
  const now = Date.now();
  for (const id of ids) {
    if (!existing.has(id)) kept.push({ id, ts: now });
  }
  safeWrite(userId, kept);
}
