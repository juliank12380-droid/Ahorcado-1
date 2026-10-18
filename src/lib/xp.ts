/**
 * Sistema de experiencia (XP) y niveles.
 *
 * Fórmula: XP para pasar del nivel N al N+1 = BASE + N * STEP
 * BASE = 100, STEP = 50  →  nivel 1 = 100 xp, nivel 2 = 150 xp, nivel 3 = 200 xp…
 * El XP total acumulado para llegar al nivel N = Σ(100 + i*50) para i=0..N-1
 */

const BASE = 100;
const STEP = 50;

/** XP necesario para subir del nivel n al n+1 (1-indexed). */
export function xpForLevel(n: number): number {
  return BASE + (n - 1) * STEP;
}

/** Nivel actual a partir del XP total acumulado. */
export function levelFromXp(totalXp: number): number {
  let lvl = 1;
  let accumulated = 0;
  while (true) {
    const needed = xpForLevel(lvl);
    if (accumulated + needed > totalXp) break;
    accumulated += needed;
    lvl++;
  }
  return lvl;
}

/** XP acumulado al inicio del nivel actual. */
export function xpAtLevelStart(level: number): number {
  let acc = 0;
  for (let i = 1; i < level; i++) acc += xpForLevel(i);
  return acc;
}

/** XP dentro del nivel actual (0 .. xpForLevel(level)-1). */
export function xpInCurrentLevel(totalXp: number): number {
  const lvl = levelFromXp(totalXp);
  return totalXp - xpAtLevelStart(lvl);
}

/** Porcentaje de progreso dentro del nivel actual (0-100). */
export function levelProgress(totalXp: number): number {
  const lvl = levelFromXp(totalXp);
  const inLevel = xpInCurrentLevel(totalXp);
  return Math.min(100, Math.round((inLevel / xpForLevel(lvl)) * 100));
}

/* -------------------------------- Recompensas -------------------------------- */

export interface XpEvent {
  reason: string;
  amount: number;
}

/** Calcula cuánto XP gana el jugador al terminar una ronda. */
export function computeXpGain(opts: {
  role: "guesser" | "writer";
  won: boolean;
  lettersGuessed?: number; // adivinador: cuántas letras acertó
  wordLength?: number;     // largo de la palabra
  failsUsed?: number;
  failsTotal?: number;
}): XpEvent[] {
  const events: XpEvent[] = [];

  if (opts.role === "guesser") {
    // Participar siempre da XP base
    events.push({ reason: "Participaste como adivinador", amount: 10 });
    if (opts.lettersGuessed && opts.lettersGuessed > 0) {
      events.push({ reason: `Adivinaste ${opts.lettersGuessed} letras`, amount: opts.lettersGuessed * 5 });
    }
    if (opts.won) {
      events.push({ reason: "¡Ganaste la ronda!", amount: 30 });
      // Bonus por vida sobrante
      const remaining = (opts.failsTotal ?? 0) - (opts.failsUsed ?? 0);
      if (remaining > 0) {
        events.push({ reason: `${remaining} vida${remaining > 1 ? "s" : ""} sobrante${remaining > 1 ? "s" : ""}`, amount: remaining * 3 });
      }
    }
  } else {
    // Escritor
    events.push({ reason: "Escribiste la palabra", amount: 15 });
    if (opts.won) {
      events.push({ reason: "¡Los adivinadores no descifran tu palabra!", amount: 35 });
    } else {
      events.push({ reason: "Adivinaron tu palabra", amount: 10 });
    }
    if (opts.wordLength && opts.wordLength >= 8) {
      events.push({ reason: `Palabra larga (${opts.wordLength} letras)`, amount: 10 });
    }
  }

  return events;
}

export function totalXpFromEvents(events: XpEvent[]): number {
  return events.reduce((acc, e) => acc + e.amount, 0);
}

/* -------------------------------- Rangos -------------------------------- */

export interface Rank {
  name: string;
  emoji: string;
  minLevel: number;
  color: string;
}

export const RANKS: Rank[] = [
  { name: "Crayón",       emoji: "🖍️",  minLevel: 1,   color: "#b9b4a6" },
  { name: "Tiza",         emoji: "✏️",  minLevel: 5,   color: "#f2efe6" },
  { name: "Borrador",     emoji: "🧹",  minLevel: 10,  color: "#6BCB77" },
  { name: "Aprendiz",     emoji: "📖",  minLevel: 20,  color: "#4ECDC4" },
  { name: "Adivinador",   emoji: "🔍",  minLevel: 35,  color: "#5CA9FF" },
  { name: "Detective",    emoji: "🕵️", minLevel: 50,  color: "#B084CC" },
  { name: "Maestro",      emoji: "🎓",  minLevel: 70,  color: "#FFD93D" },
  { name: "Gran Maestro", emoji: "🏆",  minLevel: 100, color: "#FF6B6B" },
];

export function rankForLevel(level: number): Rank {
  let r = RANKS[0];
  for (const rank of RANKS) {
    if (level >= rank.minLevel) r = rank;
  }
  return r;
}
