import { FIREBASE_PROJECT_ID } from "@/lib/firebase-server";

/**
 * Lee el perfil de Firestore del propio usuario usando SU idToken.
 * Así el servidor puede cachear nivel/xp/nombre/color al entrar a una sala
 * sin necesidad de firebase-admin.
 */

export interface ServerProfileStats {
  xp?: number;
  level?: number;
}

export interface ServerProfileDoc {
  name?: string;
  color?: string;
  stats?: ServerProfileStats;
}

function fieldToValue(field: Record<string, unknown> | undefined): unknown {
  if (!field) return undefined;
  if (typeof field.stringValue === "string") return field.stringValue;
  if (typeof field.integerValue === "string") return parseInt(field.integerValue, 10);
  if (typeof field.integerValue === "number") return field.integerValue;
  if (typeof field.doubleValue === "number") return field.doubleValue;
  if (typeof field.booleanValue === "boolean") return field.booleanValue;
  if (field.mapValue && typeof field.mapValue === "object") {
    const inner = (field.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inner)) out[k] = fieldToValue(v);
    return out;
  }
  return undefined;
}

/** Devuelve el perfil si existe y el token tiene permiso para leerlo. */
export async function loadProfileFromFirestore(idToken: string, uid: string): Promise<ServerProfileDoc | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/profiles/${uid}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
    const fields = data.fields ?? {};
    return {
      name: fieldToValue(fields.name) as string | undefined,
      color: fieldToValue(fields.color) as string | undefined,
      stats: fieldToValue(fields.stats) as ServerProfileStats | undefined,
    };
  } catch {
    return null;
  }
}
