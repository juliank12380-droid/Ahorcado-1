/**
 * Acceso a Firebase Realtime Database desde el servidor vía REST.
 *
 * Reparto de responsabilidades:
 *  - Cloud Firestore  -> usuarios y perfiles (nombre, color, estadísticas).
 *  - Realtime Database -> partidas en vivo (`/rooms/{CODE}`) y correos que
 *    aceptaron los términos (`/verified_emails/{clave}`, escritos por Apps Script).
 *
 * Nota de seguridad: en RTDB se publica el estado PÚBLICO de la partida. La
 * palabra secreta nunca se publica mientras la ronda está en curso; solo se
 * incluye cuando la ronda terminó y ya fue revelada a todos.
 */

const RTDB_URL = (
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  process.env.FIREBASE_DATABASE_URL ||
  "https://ahorcado-ac3a5-default-rtdb.firebaseio.com"
).replace(/\/$/, "");

export const rtdbEnabled = !!RTDB_URL;

const TIMEOUT = 6000;

/** Convierte un correo en clave válida de RTDB (sin . # $ [ ] /). */
export function emailKey(email: string): string {
  return email.trim().toLowerCase().replace(/[.#$[\]/]/g, "_");
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!rtdbEnabled) return null;
  try {
    const res = await fetch(`${RTDB_URL}/${path}.json`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text === "null") return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function rtdbGet<T>(path: string): Promise<T | null> {
  return request<T>(path);
}

export function rtdbPut(path: string, data: unknown): Promise<unknown> {
  return request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function rtdbPatch(path: string, data: unknown): Promise<unknown> {
  return request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function rtdbDelete(path: string): Promise<unknown> {
  return request(path, { method: "DELETE" });
}

/* ------------------------- Términos y condiciones ------------------------- */

export interface VerifiedEmailEntry {
  email?: string;
  accepted?: boolean;
  timestamp?: string | number;
}

/**
 * ¿Este correo llenó el formulario de términos?
 * Apps Script escribe en `/verified_emails/{clave}` cada respuesta nueva.
 */
export async function isEmailVerifiedInRtdb(email: string): Promise<boolean | null> {
  const entry = await rtdbGet<VerifiedEmailEntry | boolean | string>(
    `verified_emails/${emailKey(email)}`,
  );
  if (entry === null) return null; // sin dato (o RTDB no accesible)
  if (typeof entry === "boolean") return entry;
  if (typeof entry === "string") return entry.length > 0;
  if (typeof entry === "object") return entry.accepted !== false;
  return null;
}

/* ----------------------------- Partidas en vivo ---------------------------- */

export interface RoomRealtimePayload {
  code: string;
  status: string;
  visibility: string;
  network: string;
  round: number;
  guessed: string;
  /** Palabra enmascarada como texto: letras reveladas y "_" en lo oculto. */
  masked: string | null;
  hint: string | null;
  currentTurnId: string | null;
  writerId: string | null;
  winner: string | null;
  lastEvent: string | null;
  /** Solo cuando la ronda terminó (ya es pública para todos). */
  word: string | null;
  players: {
    id: string;
    name: string;
    color: string;
    role: string;
    failsUsed: number;
    failsTotal: number;
    status: string;
  }[];
  updatedAt: number;
}

/** Publica el estado público de la partida para sincronización en vivo. */
export async function publishRoom(payload: RoomRealtimePayload): Promise<void> {
  await rtdbPut(`rooms/${payload.code.toUpperCase()}`, payload);
}

/** Borra la sala de RTDB cuando se cierra. */
export async function unpublishRoom(code: string): Promise<void> {
  await rtdbDelete(`rooms/${code.toUpperCase()}`);
}
