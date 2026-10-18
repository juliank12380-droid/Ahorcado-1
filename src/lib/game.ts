/**
 * Motor compartido del ahorcado.
 * Lo usan tanto el servidor (salas online) como el modo "mismo dispositivo".
 */

export const TOTAL_LIVES = 10;
export const WORD_GUESS_PENALTY = 2; // arriesgar la palabra completa y fallar cuesta 2 vidas

export const PLAYER_COLORS = [
  { id: "blanco", value: "#F2EFE6", name: "Tiza" },
  { id: "rojo", value: "#FF6B6B", name: "Coral" },
  { id: "naranja", value: "#FFA94D", name: "Naranja" },
  { id: "amarillo", value: "#FFD93D", name: "Sol" },
  { id: "verde", value: "#6BCB77", name: "Menta" },
  { id: "turquesa", value: "#4ECDC4", name: "Turquesa" },
  { id: "azul", value: "#5CA9FF", name: "Cielo" },
  { id: "morado", value: "#B084CC", name: "Lila" },
  { id: "rosa", value: "#FF8FAB", name: "Rosa" },
  { id: "lima", value: "#C0E218", name: "Lima" },
];

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Normaliza una palabra o frase:
 * - mayúsculas
 * - sin acentos
 * - conserva la Ñ
 * - conserva espacios internos
 * - colapsa múltiples espacios a uno
 */
/**
 * Normaliza una palabra o frase:
 * - Mayúsculas
 * - Sin acentos (conserva Ñ)
 * - Conserva un solo espacio entre palabras
 */
export function normalizeWord(raw: string): string {
  // 1. Limpieza básica y mayúsculas
  let text = raw.toLocaleUpperCase("es").trim();
  
  // 2. Normalizar caracteres uno a uno
  text = text.split("").map(c => {
    if (c === "Ñ") return "Ñ";
    if (c === " " || c === "\t" || c === "\n") return " ";
    // Quitar acentos
    return c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }).join("");

  // 3. Limpiar todo lo que no sea letras A-Z, Ñ o Espacio
  return text
    .replace(/[^A-ZÑ ]/g, "")
    .replace(/\s+/g, " ") // Colapsar múltiples espacios
    .trim();
}

/** Cuenta solo letras, ignorando espacios. */
export function letterCount(text: string): number {
  return text.replace(/ /g, "").length;
}

/** Acepta frases de 2 a 32 letras (los espacios no cuentan). */
export function isValidWord(w: string): boolean {
  const letters = letterCount(w);
  return /^[A-ZÑ ]+$/.test(w) && letters >= 2 && letters <= 32;
}

export function isValidLetter(l: string): boolean {
  return /^[A-ZÑ]$/.test(l);
}

export function generateRoomCode(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Reparte las 10 vidas entre N adivinadores de la forma más pareja posible.
 * p.ej. 10 entre 4 => [3,3,2,2]
 */
export function distributeLives(guessers: number, total = TOTAL_LIVES): number[] {
  const base = Math.floor(total / guessers);
  const extra = total % guessers;
  return Array.from({ length: guessers }, (_, i) => base + (i < extra ? 1 : 0));
}

/* ------------------------------ Tipos del motor ------------------------------ */

export type EngineStatus = "writing" | "playing" | "finished";
export type EngineWinner = "guessers" | "writer" | null;

export interface EnginePlayer {
  id: string;
  name: string;
  color: string;
  role: "writer" | "guesser";
  failsUsed: number;
  failsTotal: number;
  status: "alive" | "hung";
}

export interface EngineState {
  status: EngineStatus;
  word: string | null;
  guessed: string; // letras ya usadas, concatenadas
  players: EnginePlayer[];
  currentTurnId: string | null;
  winner: EngineWinner;
}

export type GuessResult =
  | { ok: true; kind: "letter-hit" | "letter-miss" | "word-hit" | "word-miss"; gameOver: boolean }
  | { ok: false; error: string };

export function guessersOf(players: EnginePlayer[]): EnginePlayer[] {
  return players.filter((p) => p.role === "guesser");
}

export function aliveGuessers(players: EnginePlayer[]): EnginePlayer[] {
  return guessersOf(players).filter((p) => p.status === "alive");
}

/** Siguiente adivinador vivo después de `fromId` (orden de la lista). */
export function nextTurnId(players: EnginePlayer[], fromId: string | null): string | null {
  const alive = aliveGuessers(players);
  if (alive.length === 0) return null;
  const idx = players.findIndex((p) => p.id === fromId);
  if (idx === -1) return alive[0].id;
  for (let step = 1; step <= players.length; step++) {
    const cand = players[(idx + step) % players.length];
    if (cand.role === "guesser" && cand.status === "alive") return cand.id;
  }
  return null;
}

export function isWordComplete(word: string, guessed: string): boolean {
  return word.split("").every((c) => guessed.includes(c));
}

/**
 * Aplica una jugada del adivinador en turno. Muta `st` localmente y devuelve el resultado.
 * - Letra correcta: el jugador conserva el turno.
 * - Letra fallida: pierde 1 vida y pasa el turno.
 * - Palabra completa fallida: pierde 2 vidas y pasa el turno.
 * - Quedarse sin vidas => ahorcado (ya no juega).
 */
export function applyGuess(
  st: EngineState,
  playerId: string,
  rawGuess: string,
): GuessResult {
  if (st.status !== "playing" || !st.word) return { ok: false, error: "La partida no está en curso" };
  if (st.currentTurnId !== playerId) return { ok: false, error: "No es tu turno" };
  const me = st.players.find((p) => p.id === playerId);
  if (!me || me.role !== "guesser" || me.status !== "alive") {
    return { ok: false, error: "Ya no puedes adivinar" };
  }

  const guess = normalizeWord(rawGuess);
  if (!guess) return { ok: false, error: "Jugada inválida" };

  const registerFail = (amount: number) => {
    me.failsUsed = Math.min(me.failsTotal, me.failsUsed + amount);
    if (me.failsUsed >= me.failsTotal) me.status = "hung";
  };

  const finishOrAdvance = () => {
    if (isWordComplete(st.word!, st.guessed)) {
      st.status = "finished";
      st.winner = "guessers";
      return true;
    }
    if (aliveGuessers(st.players).length === 0) {
      st.status = "finished";
      st.winner = "writer";
      return true;
    }
    return false;
  };

  // Intento de palabra completa
  if (guess.length > 1) {
    if (guess.length !== st.word.length) {
      return { ok: false, error: `La palabra tiene ${st.word.length} letras` };
    }
    if (guess === st.word) {
      for (const c of guess) if (!st.guessed.includes(c)) st.guessed += c;
      st.status = "finished";
      st.winner = "guessers";
      return { ok: true, kind: "word-hit", gameOver: true };
    }
    registerFail(WORD_GUESS_PENALTY);
    const wordMissOver = finishOrAdvance();
    if (!wordMissOver) st.currentTurnId = nextTurnId(st.players, playerId);
    return { ok: true, kind: "word-miss", gameOver: wordMissOver };
  }

  // Letra
  const letter = guess;
  if (st.guessed.includes(letter)) {
    return { ok: false, error: "Esa letra ya se usó" };
  }
  st.guessed += letter;

  if (st.word.includes(letter)) {
    const over = finishOrAdvance(); // conserva el turno si acertó
    return { ok: true, kind: "letter-hit", gameOver: over };
  }

  registerFail(1);
  const over = finishOrAdvance();
  if (!over) st.currentTurnId = nextTurnId(st.players, playerId);
  return { ok: true, kind: "letter-miss", gameOver: over };
}

/** Palabra enmascarada vista por los adivinadores: letra o null por posición. */
export function maskWord(word: string, guessed: string): (string | null)[] {
  return word.split("").map((c) => (guessed.includes(c) ? c : null));
}

export function displayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 16);
}

/**
 * Calcula cuántos puntos gana un adivinador al terminar una ronda.
 * Escala inversa: más vidas sobran = más puntos.
 *
 * Fórmula: puntos = vidasSobrantes * (10 / vidasTotales) * 10
 * Ejemplos con 5 vidas totales:
 *   5 vidas sobrantes (sin fallos)  → 10 pts por vida = 50 pts
 *   4 sobrantes                     → 8 pts por vida  = 32 pts
 *   1 sobrante                      → 2 pts por vida  = 2 pts
 *   0 sobrantes (ahorcado)          → 0 pts
 *
 * Para el escritor: gana puntos si nadie adivina su palabra.
 *   25 pts fijos por cada adivinador ahorcado.
 */
/**
 * Puntos por ronda. Cada vida vale 100 / vidasTotales.
 *
 * Ejemplos:
 *  - 1 vida total  → cada vida vale 100 pts
 *  - 2 vidas total → cada vida vale 50 pts
 *  - 5 vidas total → cada vida vale 20 pts
 *  - 10 vidas      → cada vida vale 10 pts
 *
 * Puntos = vidasSobrantes × (100 / vidasTotales)
 */
export function calcRoundPoints(opts: {
  role: "guesser" | "writer";
  won: boolean;
  failsUsed: number;
  failsTotal: number;
  guessersHung?: number;
}): number {
  if (opts.role === "guesser") {
    if (!opts.won && opts.failsUsed >= opts.failsTotal) return 0;
    const remaining = opts.failsTotal - opts.failsUsed;
    if (opts.failsTotal === 0) return 0;
    const pointsPerLife = Math.round(100 / opts.failsTotal);
    return remaining * pointsPerLife;
  } else {
    if (!opts.won) return 0;
    return (opts.guessersHung ?? 1) * 25;
  }
}
