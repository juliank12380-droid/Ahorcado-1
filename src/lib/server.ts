import { createHash } from "crypto";
import { and, asc, eq, ilike } from "drizzle-orm";
import { rankForLevel } from "@/lib/xp";
import { db } from "@/db";
import { players, rooms, bannedPlayers, type PlayerRow, type RoomRow } from "@/db/schema";
import {
  maskWord,
  nextTurnId,
  type EngineState,
  type EnginePlayer,
} from "@/lib/game";
import type { PlayerDTO, RoomStateDTO } from "@/lib/dto";

export function hashPassword(pw: string): string {
  return createHash("sha256").update(`crayola-ahorcado:${pw}`).digest("hex");
}

export async function getRoomByCode(code: string): Promise<RoomRow | null> {
  const rows = await db
    .select()
    .from(rooms)
    .where(eq(rooms.code, code.toUpperCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRoomPlayers(roomId: string): Promise<PlayerRow[]> {
  return db
    .select()
    .from(players)
    .where(eq(players.roomId, roomId))
    .orderBy(asc(players.createdAt), asc(players.id));
}

export async function findPlayerByName(
  roomId: string,
  name: string,
): Promise<PlayerRow | null> {
  const rows = await db
    .select()
    .from(players)
    .where(and(eq(players.roomId, roomId), ilike(players.name, name)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findPlayerByUid(
  roomId: string,
  uid: string,
): Promise<PlayerRow | null> {
  const rows = await db
    .select()
    .from(players)
    .where(and(eq(players.roomId, roomId), eq(players.uid, uid)))
    .limit(1);
  return rows[0] ?? null;
}

export async function touchRoom(roomId: string) {
  await db
    .update(rooms)
    .set({ updatedAt: new Date() })
    .where(eq(rooms.id, roomId));
}

export async function touchPlayer(playerId: string) {
  await db
    .update(players)
    .set({ lastSeenAt: new Date() })
    .where(eq(players.id, playerId));
}

/** Valida la sesión del jugador (playerId + token). */
export async function authPlayer(
  roomId: string,
  playerId: string | null,
  token: string | null,
): Promise<PlayerRow | null> {
  if (!playerId || !token) return null;
  const rows = await db
    .select()
    .from(players)
    .where(and(eq(players.id, playerId), eq(players.roomId, roomId)))
    .limit(1);
  const p = rows[0];
  if (!p || p.token !== token) return null;
  return p;
}

/** Adapta las filas a la forma del motor compartido. */
export function toEngineState(room: RoomRow, rows: PlayerRow[]): EngineState {
  return {
    status: room.status === "finished" ? "finished" : room.status === "writing" ? "writing" : "playing",
    word: room.word,
    guessed: room.guessed,
    currentTurnId: room.currentTurnId,
    winner: (room.winner as EngineState["winner"]) ?? null,
    players: rows.map<EnginePlayer>((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      role: p.role as EnginePlayer["role"],
      failsUsed: p.failsUsed,
      failsTotal: p.failsTotal,
      status: p.status as EnginePlayer["status"],
    })),
  };
}

/** Construye el DTO de estado que ve un jugador concreto. */
export function buildRoomState(
  room: RoomRow,
  rows: PlayerRow[],
  me: PlayerRow | null,
): RoomStateDTO {
  const now = Date.now();
  const writer = rows.find((p) => p.role === "writer") ?? null;
  const inGame = room.status === "playing" || room.status === "finished";
  const word = room.word;

  const dtos: PlayerDTO[] = rows.map((p) => {
    const rank = rankForLevel(p.level);
    return {
    id: p.id,
    name: p.name,
    color: p.color,
    photo: p.photo ?? null,
    isHost: p.isHost,
    level: p.level,
    xp: p.xp,
    rankName: rank.name,
    rankEmoji: rank.emoji,
    rankColor: rank.color,
    sessionPoints: p.sessionPoints,
    role: p.role as PlayerDTO["role"],
    failsUsed: p.failsUsed,
    failsTotal: p.failsTotal,
    status: p.status as PlayerDTO["status"],
    online: now - new Date(p.lastSeenAt).getTime() < 15_000,
  };
  });

  const iAmWriter = !!me && me.role === "writer";
  const revealWord = room.status === "finished";

  return {
    code: room.code,
    status: room.status as RoomStateDTO["status"],
    visibility: room.visibility as RoomStateDTO["visibility"],
    network: room.network as RoomStateDTO["network"],
    title: room.title ?? null,
    maxPlayers: room.maxPlayers,
    round: room.round,
    hint: inGame ? room.hint : null,
    wordLength: inGame && word ? word.length : null,
    masked: inGame && word ? maskWord(word, room.guessed) : null,
    word: word && (revealWord || (iAmWriter && room.status !== "lobby")) ? word : null,
    guessed: room.guessed,
    currentTurnId: room.currentTurnId,
    writerId: writer?.id ?? null,
    lastWriterId: room.lastWriterId ?? null,
    winner: (room.winner as RoomStateDTO["winner"]) ?? null,
    players: dtos,
    me: me?.id ?? null,
    isHost: !!me?.isHost,
    lastEvent: room.lastEvent,
    livesTotal: rows
      .filter((p) => p.role === "guesser")
      .reduce((acc, p) => acc + p.failsUsed, 0),
  };
}

/**
 * Publica en Realtime Database el estado público de la sala para que todos
 * los dispositivos lo reciban al instante (sin esperar al sondeo).
 */
export async function syncRoomToRtdb(room: RoomRow, rows: PlayerRow[]): Promise<void> {
  const { publishRoom } = await import("@/lib/rtdb");
  const finished = room.status === "finished";
  const inGame = room.status === "playing" || finished;
  const writer = rows.find((p) => p.role === "writer") ?? null;

  await publishRoom({
    code: room.code,
    status: room.status,
    visibility: room.visibility,
    network: room.network,
    round: room.round,
    guessed: room.guessed,
    // Sincronización RTDB: usamos un formato de cadena simple.
    // Ej: "C_S_/A_U_" donde "_" es oculto y "/" es espacio.
    masked:
      inGame && room.word
        ? maskWord(room.word, room.guessed)
            .map((c) => c ?? "_")
            .join("")
        : null,
    hint: inGame ? room.hint : null,
    currentTurnId: room.currentTurnId,
    writerId: writer?.id ?? null,
    winner: room.winner,
    lastEvent: room.lastEvent,
    // La palabra solo viaja cuando la ronda terminó y ya es pública.
    word: finished ? room.word : null,
    players: rows.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      role: p.role,
      failsUsed: p.failsUsed,
      failsTotal: p.failsTotal,
      status: p.status,
    })),
    updatedAt: Date.now(),
  });
}

/** ¿Está baneado este uid de esta sala? */
export async function isPlayerBanned(roomId: string, uid: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(bannedPlayers)
    .where(and(eq(bannedPlayers.roomId, roomId), eq(bannedPlayers.uid, uid)))
    .limit(1);
  return rows.length > 0;
}

/** Banea a un jugador de la sala. */
export async function banPlayer(roomId: string, uid: string, name: string): Promise<void> {
  await db
    .insert(bannedPlayers)
    .values({ roomId, uid, name })
    .onConflictDoNothing();
}

export { nextTurnId };
