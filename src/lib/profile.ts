"use client";

/**
 * Perfil del jugador en Cloud Firestore.
 *
 * ─ Personalización: nombre, color, stickmanStyle
 * ─ Estadísticas completas: partidas, victorias, derrotas, letras, XP, nivel
 * ─ Historial de XP para la barra de progreso
 */
import { doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { getFbDb, firebaseConfigured } from "@/lib/firebase";
import { computeXpGain, levelFromXp, totalXpFromEvents } from "@/lib/xp";

export interface PlayerStats {
  // Partidas
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  // Como adivinador
  gamesAsGuesser: number;
  gamesWonAsGuesser: number;
  lettersGuessed: number;
  lettersMissed: number;
  // Como escritor
  gamesAsWriter: number;
  gamesWonAsWriter: number;
  wordsWritten: number;
  // Progresión
  xp: number;
  level: number;
}

export interface PlayerProfileDoc {
  // Personalización
  name?: string;
  color?: string;
  // Stats
  stats?: Partial<PlayerStats>;
  updatedAt?: unknown;
}

const DEFAULT_STATS: PlayerStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  gamesAsGuesser: 0,
  gamesWonAsGuesser: 0,
  lettersGuessed: 0,
  lettersMissed: 0,
  gamesAsWriter: 0,
  gamesWonAsWriter: 0,
  wordsWritten: 0,
  xp: 0,
  level: 1,
};

export function mergeStats(partial?: Partial<PlayerStats>): PlayerStats {
  return { ...DEFAULT_STATS, ...partial };
}

export async function loadProfileDoc(uid: string): Promise<PlayerProfileDoc | null> {
  const db = getFbDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "profiles", uid));
    return snap.exists() ? (snap.data() as PlayerProfileDoc) : null;
  } catch {
    return null;
  }
}

export async function saveProfileDoc(uid: string, patch: Partial<PlayerProfileDoc>): Promise<void> {
  const db = getFbDb();
  if (!db) return;
  try {
    await setDoc(doc(db, "profiles", uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  } catch { /* Firestore sin reglas: se ignora */ }
}

/** Registra el resultado de una ronda y actualiza XP + estadísticas en Firestore. */
export async function recordGameResult(opts: {
  uid: string;
  role: "guesser" | "writer";
  won: boolean;
  lettersGuessed?: number;
  lettersMissed?: number;
  wordLength?: number;
  failsUsed?: number;
  failsTotal?: number;
}): Promise<void> {
  if (!firebaseConfigured) return;
  const db = getFbDb();
  if (!db) return;

  const events = computeXpGain({
    role: opts.role,
    won: opts.won,
    lettersGuessed: opts.lettersGuessed,
    wordLength: opts.wordLength,
    failsUsed: opts.failsUsed,
    failsTotal: opts.failsTotal,
  });
  const xpGained = totalXpFromEvents(events);

  // Leemos el XP actual para calcular el nuevo nivel
  let currentXp = 0;
  try {
    const snap = await getDoc(doc(db, "profiles", opts.uid));
    if (snap.exists()) {
      const data = snap.data() as PlayerProfileDoc;
      currentXp = data.stats?.xp ?? 0;
    }
  } catch { /* sin datos previos */ }

  const newXp = currentXp + xpGained;
  const newLevel = levelFromXp(newXp);

  const statsDelta: Record<string, ReturnType<typeof increment>> = {
    "stats.gamesPlayed": increment(1),
    "stats.xp": increment(xpGained),
  };

  if (opts.won) statsDelta["stats.gamesWon"] = increment(1);
  else statsDelta["stats.gamesLost"] = increment(1);

  if (opts.role === "guesser") {
    statsDelta["stats.gamesAsGuesser"] = increment(1);
    if (opts.won) statsDelta["stats.gamesWonAsGuesser"] = increment(1);
    if (opts.lettersGuessed) statsDelta["stats.lettersGuessed"] = increment(opts.lettersGuessed);
    if (opts.lettersMissed) statsDelta["stats.lettersMissed"] = increment(opts.lettersMissed);
  } else {
    statsDelta["stats.gamesAsWriter"] = increment(1);
    if (opts.won) statsDelta["stats.gamesWonAsWriter"] = increment(1);
    statsDelta["stats.wordsWritten"] = increment(1);
  }

  // El nivel se guarda directo (no como incremento) para que sea consistente
  try {
    await setDoc(
      doc(db, "profiles", opts.uid),
      { ...statsDelta, "stats.level": newLevel, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch { /* noop */ }
}
