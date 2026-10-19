import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { players, rooms, type PlayerRow, type RoomRow } from "@/db/schema";
import {
  applyGuess,
  calcRoundPoints,
  clipEvent,
  distributeLives,
  isValidWord,
  normalizeWord,
  nextTurnId,
  PLAYER_COLORS,
  type EngineState,
} from "@/lib/game";
import {
  authPlayer,
  banPlayer,
  buildRoomState,
  getRoomByCode,
  getRoomPlayers,
  syncRoomToRtdb,
  toEngineState,
} from "@/lib/server";
import { unpublishRoom } from "@/lib/rtdb";

interface Ctx {
  room: RoomRow;
  me: PlayerRow;
  rows: PlayerRow[];
}

function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function loadCtx(code: string, playerId: string | null, token: string | null): Promise<Ctx | NextResponse> {
  const room = await getRoomByCode(code);
  if (!room) return err("La sala ya no existe", 404);
  const me = await authPlayer(room.id, playerId, token);
  if (!me) return err("Sesión no válida", 401);
  const rows = await getRoomPlayers(room.id);
  return { room, me, rows };
}

async function persistEngine(roomId: string, st: EngineState, lastEvent: string | null) {
  for (const p of st.players) {
    await db
      .update(players)
      .set({ failsUsed: p.failsUsed, failsTotal: p.failsTotal, status: p.status, role: p.role })
      .where(eq(players.id, p.id));
  }
  await db
    .update(rooms)
    .set({
      guessed: st.guessed,
      currentTurnId: st.currentTurnId,
      status: st.status,
      winner: st.winner,
      lastEvent: lastEvent ? clipEvent(lastEvent) : null,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, roomId));
}

async function abortToLobby(roomId: string, event: string) {
  await db
    .update(players)
    .set({ role: "guesser", failsUsed: 0, failsTotal: 0, status: "alive" })
    .where(eq(players.roomId, roomId));
  await db
    .update(rooms)
    .set({
      status: "lobby",
      word: null,
      hint: null,
      guessed: "",
      currentTurnId: null,
      winner: null,
      lastEvent: clipEvent(event),
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, roomId));
}

/** Ajusta turno/fin de partida tras sacar a alguien de la sala. */
async function resolveAfterRemoval(room: RoomRow, removed: PlayerRow, roomId: string): Promise<string | null> {
  const fresh = await getRoomPlayers(roomId);
  const st = toEngineState({ ...room }, fresh);

  if (room.status === "writing") {
    // BUGFIX: si el escritor se va, o si se va el último adivinador en plena
    // escritura, la sala quedaba atascada para siempre en "writing".
    if (removed.role === "writer") {
      await abortToLobby(roomId, `${removed.name} salió en plena ronda: ronda cancelada`);
      return null;
    }
    if (fresh.filter((p) => p.role === "guesser").length === 0) {
      await abortToLobby(roomId, "Sin adivinadores, la ronda terminó");
      return null;
    }
    return null;
  }
  if (room.status !== "playing") return null;

  const guessers = fresh.filter((p) => p.role === "guesser");
  if (guessers.length === 0) {
    await abortToLobby(roomId, "Sin adivinadores, la ronda terminó");
    return null;
  }
  let current = room.currentTurnId;
  if (current === removed.id || !guessers.some((g) => g.id === current && g.status === "alive")) {
    current = nextTurnId(st.players, removed.id);
  }
  const alive = guessers.filter((g) => g.status === "alive");
  if (alive.length === 0) {
    await db
      .update(rooms)
      .set({ status: "finished", winner: "writer", currentTurnId: null, lastEvent: "Todos quedaron ahorcados", updatedAt: new Date() })
      .where(eq(rooms.id, roomId));
    return null;
  }
  await db
    .update(rooms)
    .set({ currentTurnId: current, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = (await req.json().catch(() => null)) as {
    playerId?: string;
    token?: string;
    action?: string;
    [k: string]: unknown;
  } | null;
  if (!body?.action) return err("Acción inválida");

  const ctx = await loadCtx(code, body.playerId ?? null, body.token ?? null);
  if (ctx instanceof NextResponse) return ctx;
  const { room, me, rows } = ctx;

  const finish = async (lastEvent?: string | null) => {
    const freshRoom = { ...(await getRoomByCode(code))! };
    const freshPlayers = await getRoomPlayers(freshRoom.id);
    const freshMe = freshPlayers.find((p) => p.id === me.id) ?? me;
    const state = buildRoomState(freshRoom, freshPlayers, freshMe);
    // Espejo en Realtime Database: los demás dispositivos lo reciben al instante.
    void syncRoomToRtdb(freshRoom, freshPlayers);
    return NextResponse.json({ ok: true, state, event: lastEvent ?? null });
  };

  switch (body.action) {
    /* ----------------------------------- lobby ----------------------------------- */
    case "setColor": {
      const color = String(body.color ?? "");
      if (!PLAYER_COLORS.some((c) => c.value === color)) return err("Color inválido");
      if (rows.some((p) => p.id !== me.id && p.color === color)) return err("Ese color ya lo tiene otro jugador");
      await db
        .update(players)
        .set({ color, lastSeenAt: new Date() })
        .where(and(eq(players.id, me.id), ne(players.color, color)));
      return finish();
    }

    case "setVisibility": {
      if (!me.isHost) return err("Solo el anfitrión cambia la privacidad", 403);
      const visibility = body.visibility === "private" ? "private" : "public";
      await db
        .update(rooms)
        .set({
          visibility,
          lastEvent: clipEvent(visibility === "public" ? "La sala ahora es pública" : "La sala ahora es privada"),
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, room.id));
      return finish();
    }

    case "start": {
      if (!me.isHost) return err("Solo el anfitrión puede iniciar", 403);
      if (room.status !== "lobby" && room.status !== "finished") return err("La ronda ya empezó");
      if (rows.length < 2) return err("Se necesitan al menos 2 jugadores (1 escribe y 1+ adivinan)");

      // El sistema elige al escritor AL AZAR. Evita repetir al escritor de la
      // ronda anterior para que el lápiz siempre rote (incluso si solo son 2).
      let candidates = rows;
      if (room.lastWriterId) {
        const withoutLast = rows.filter((p) => p.id !== room.lastWriterId);
        if (withoutLast.length > 0) candidates = withoutLast;
      }
      const writer = candidates[Math.floor(Math.random() * candidates.length)];
      const guessers = rows.filter((p) => p.id !== writer.id);

      const lives = distributeLives(guessers.length);
      for (const p of rows) {
        if (p.id === writer.id) {
          await db.update(players).set({ role: "writer", status: "alive", failsUsed: 0, failsTotal: 0 }).where(eq(players.id, p.id));
        } else {
          const idx = guessers.findIndex((g) => g.id === p.id);
          await db
            .update(players)
            .set({ role: "guesser", status: "alive", failsUsed: 0, failsTotal: lives[idx] })
            .where(eq(players.id, p.id));
        }
      }
      await db
        .update(rooms)
        .set({
          status: "writing",
          round: room.round + 1,
          word: null,
          hint: null,
          guessed: "",
          currentTurnId: null,
          winner: null,
          lastWriterId: writer.id,
          lastEvent: clipEvent(`Ronda ${room.round + 1}: ${writer.name} está eligiendo la palabra…`),
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, room.id));
      return finish();
    }

    case "restart": {
      if (!me.isHost) return err("Solo el anfitrión puede reiniciar", 403);
      await abortToLobby(room.id, "Ronda terminada: de vuelta a la sala");
      return finish();
    }

    /* ----------------------------------- juego ----------------------------------- */
    case "submitWord": {
      if (room.status !== "writing") return err("La sala no está esperando una palabra");
      if (me.role !== "writer") return err("Solo el escritor elige la palabra", 403);
      const word = normalizeWord(String(body.word ?? ""));
      const hint = String(body.hint ?? "").trim().slice(0, 80) || null;
      if (!isValidWord(word)) return err("La respuesta debe tener entre 2 y 32 letras. Puedes usar espacios.");
      const st = toEngineState(room, rows);
      // BUGFIX: sin adivinadores vivos la partida quedaba muerta para siempre.
      const aliveGuessers = st.players.filter((p) => p.role === "guesser" && p.status === "alive");
      if (aliveGuessers.length === 0) {
        return err("No hay adivinadores en la sala. Espera a que se una alguien.");
      }
      st.status = "playing";
      st.word = word;
      st.currentTurnId = aliveGuessers[0].id;
      await db
        .update(rooms)
        .set({
          status: "playing",
          word,
          hint,
          currentTurnId: st.currentTurnId,
          lastEvent: clipEvent(`${me.name} ya escribió la palabra. ¡A adivinar!`),
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, room.id));
      return finish();
    }

    case "guess": {
      const st = toEngineState(room, rows);
      const result = applyGuess(st, me.id, String(body.value ?? ""));
      if (!result.ok) return err(result.error);
      const letter = normalizeWord(String(body.value ?? ""));
      let ev: string;
      if (result.kind === "letter-hit") ev = `${me.name} acertó la ${letter}`;
      else if (result.kind === "letter-miss") ev = `${me.name} falló con la ${letter}`;
      else if (result.kind === "word-hit") ev = `¡${me.name} adivinó la palabra completa!`;
      else ev = `${me.name} arriesgó la palabra y falló (−2 vidas)`;
      if (st.status === "finished") {
        ev = st.winner === "guessers"
          ? `Descifraron la palabra. ¡Ganan los adivinadores!`
          : `Todos ahorcados. ¡Gana ${st.players.find((p) => p.role === "writer")?.name ?? "el escritor"}!`;

        // ── Calcular y sumar puntos de sesión ──
        const guessersHung = st.players.filter(
          (p) => p.role === "guesser" && p.status === "hung",
        ).length;

        for (const sp of st.players) {
          const dbRow = rows.find((r) => r.id === sp.id);
          if (!dbRow) continue;

          const pts = calcRoundPoints({
            role: sp.role as "guesser" | "writer",
            won: st.winner === (sp.role === "guesser" ? "guessers" : "writer"),
            failsUsed: sp.failsUsed,
            failsTotal: sp.failsTotal,
            guessersHung,
          });

          if (pts > 0) {
            await db
              .update(players)
              .set({ sessionPoints: dbRow.sessionPoints + pts })
              .where(eq(players.id, sp.id));
          }
        }
      }
      await persistEngine(room.id, st, ev);
      return finish(ev);
    }

    case "skipTurn": {
      if (!me.isHost) return err("Solo el anfitrión puede saltar turnos", 403);
      if (room.status !== "playing") return err("No hay partida en curso");
      const st = toEngineState(room, rows);
      const next = nextTurnId(st.players, room.currentTurnId);
      await db
        .update(rooms)
        .set({ currentTurnId: next, lastEvent: clipEvent("Turno saltado"), updatedAt: new Date() })
        .where(eq(rooms.id, room.id));
      return finish();
    }

    /* --------------------------------- jugadores --------------------------------- */
    case "kick": {
      if (!me.isHost) return err("Solo el anfitrión puede expulsar", 403);
      const targetId = String(body.targetId ?? "");
      const target = rows.find((p) => p.id === targetId);
      if (!target) return err("Jugador no encontrado");
      if (target.id === me.id) return err("No puedes expulsarte a ti mismo");
      await db.delete(players).where(eq(players.id, target.id));
      await resolveAfterRemoval(room, target, room.id);
      await db.update(rooms).set({ lastEvent: clipEvent(`${target.name} fue expulsado`), updatedAt: new Date() }).where(eq(rooms.id, room.id));
      return finish();
    }

    case "ban": {
      if (!me.isHost) return err("Solo el anfitrión puede vetar", 403);
      const banTargetId = String(body.targetId ?? "");
      const banTarget = rows.find((p) => p.id === banTargetId);
      if (!banTarget) return err("Jugador no encontrado");
      if (banTarget.id === me.id) return err("No puedes vetarte a ti mismo");
      if (!banTarget.uid) return err("Ese jugador no tiene identidad registrada");
      await banPlayer(room.id, banTarget.uid, banTarget.name);
      await db.delete(players).where(eq(players.id, banTarget.id));
      await resolveAfterRemoval(room, banTarget, room.id);
      await db.update(rooms).set({ lastEvent: clipEvent(`${banTarget.name} fue vetado de la sala`), updatedAt: new Date() }).where(eq(rooms.id, room.id));
      return finish();
    }

    case "setMaxPlayers": {
      if (!me.isHost) return err("Solo el anfitrión puede cambiar el límite", 403);
      // Nunca puede quedar por debajo de la gente ya conectada.
      const minAllowed = Math.max(2, rows.length);
      const mp = Math.min(11, Math.max(minAllowed, Number(body.maxPlayers) || 11));
      await db
        .update(rooms)
        .set({ maxPlayers: mp, updatedAt: new Date() })
        .where(eq(rooms.id, room.id));
      return finish();
    }

    case "leave": {
      await db.delete(players).where(eq(players.id, me.id));
      const remaining = await getRoomPlayers(room.id);
      if (remaining.length === 0) {
        await db.delete(rooms).where(eq(rooms.id, room.id));
        void unpublishRoom(room.code);
        return NextResponse.json({ ok: true, state: null, event: "room-closed" });
      }
      if (me.isHost) {
        await db.update(players).set({ isHost: true }).where(eq(players.id, remaining[0].id));
      }
      await resolveAfterRemoval(room, me, room.id);
      return NextResponse.json({ ok: true, state: null, event: "left" });
    }

    default:
      return err("Acción desconocida");
  }
}
