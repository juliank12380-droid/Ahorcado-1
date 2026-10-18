/** Tipos que viajan al cliente (nunca se exponen hash ni tokens). */

export interface PlayerDTO {
  id: string;
  name: string;
  color: string;
  photo: string | null;
  isHost: boolean;
  role: "writer" | "guesser";
  failsUsed: number;
  failsTotal: number;
  status: "alive" | "hung";
  online: boolean;
  level: number;
  xp: number;
  rankName: string;
  rankEmoji: string;
  rankColor: string;
  sessionPoints: number;
}

export type RoomStatus = "lobby" | "writing" | "playing" | "finished";
export type RoomVisibility = "public" | "private";
export type RoomNetwork = "online" | "lan";

export interface RoomStateDTO {
  code: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  network: RoomNetwork;
  title: string | null;
  maxPlayers: number;
  round: number;
  hint: string | null;
  wordLength: number | null;
  masked: (string | null)[] | null;
  /** Palabra completa: solo para el escritor o cuando la ronda terminó. */
  word: string | null;
  guessed: string;
  currentTurnId: string | null;
  writerId: string | null;
  lastWriterId: string | null;
  winner: "guessers" | "writer" | null;
  players: PlayerDTO[];
  me: string | null;
  isHost: boolean;
  lastEvent: string | null;
  livesTotal: number;
}

/** Fila del buscador de partidas públicas. */
export interface PublicRoomDTO {
  code: string;
  title: string | null;
  network: RoomNetwork;
  status: RoomStatus;
  round: number;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  colors: string[];
  updatedAgoMs: number;
}

export interface ApiError {
  ok: false;
  error: string;
}

export interface JoinResponse {
  ok: true;
  code: string;
  playerId: string;
  token: string;
  name: string;
  color: string;
  isHost: boolean;
  photo: string | null;
}

export type TermsStatus = "accepted" | "not-found" | "unconfigured";

export interface TermsCheckResponse {
  ok: true;
  status: TermsStatus;
  email: string;
  message: string;
}
