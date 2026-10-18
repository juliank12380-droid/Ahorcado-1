import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { displayName, PLAYER_COLORS } from "@/lib/game";
import { loadProfileFromFirestore } from "@/lib/firestore-server";
import { findPlayerByUid, getRoomByCode, getRoomPlayers, isPlayerBanned, syncRoomToRtdb } from "@/lib/server";
import { resolveIdentity } from "@/lib/identity";
import type { JoinResponse } from "@/lib/dto";

const MAX_PLAYERS = 11;

function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Unirse a una sala con código + nombre. Si iniciaste con Google, tu cuenta
 * recupera tu lugar (color, vidas y turno) desde cualquier dispositivo.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: string;
    name?: string;
    color?: string;
    idToken?: string;
    guestId?: string;
  } | null;

  const code = (body?.code ?? "").toUpperCase().trim();
  const name = displayName(body?.name ?? "");

  if (!code) return err("Escribe el código de la sala");
  if (name.length < 2) return err("Escribe un nombre de al menos 2 letras");

  const room = await getRoomByCode(code);
  if (!room) return err("No existe una sala con ese código", 404);

  const identity = await resolveIdentity(body?.idToken, body?.guestId);
  if (!identity.ok) return err(identity.error, identity.status);
  const { uid, photo, kind } = identity.identity;
  const hasAccount = kind === "account";
  const cloudProfile =
    body?.idToken && hasAccount
      ? await loadProfileFromFirestore(body.idToken, uid)
      : null;

  // Baneado de esta sala
  if (uid && await isPlayerBanned(room.id, uid)) {
    return err("Has sido vetado de esta sala por el anfitrión.", 403);
  }

  // Salas en línea: solo con cuenta. Las LAN quedan abiertas a invitados.
  if (room.network === "online" && !hasAccount) {
    return err("Esta sala es en línea: inicia sesión para entrar. Como invitado puedes jugar en red local o en el mismo teléfono.", 403);
  }

  const current = await getRoomPlayers(room.id);
  const validWantedColor = PLAYER_COLORS.some((c) => c.value === body?.color)
    ? (body!.color as string)
    : null;

  const colorTakenBy = (color: string, excludeId?: string) =>
    current.some((p) => p.id !== excludeId && p.color === color);

  // ¿Reingreso con la misma identidad (cuenta o invitado guardado)?
  {
    const existing = uid ? await findPlayerByUid(room.id, uid) : null;
    if (existing) {
      // si quiere cambiarse a un nombre que ya usa OTRO, no
      const nameClash = current.some(
        (p) => p.id !== existing.id && p.name.toLowerCase() === name.toLowerCase(),
      );
      if (nameClash) {
        return err(`Otro jugador ya usa el nombre "${name}" en esta sala. Elige otro.`, 409);
      }
      const color =
        validWantedColor && !colorTakenBy(validWantedColor, existing.id)
          ? validWantedColor
          : existing.color;
      const [updated] = await db
        .update(players)
        .set({ name, color, photo: photo ?? existing.photo, lastSeenAt: new Date() })
        .where(eq(players.id, existing.id))
        .returning();
      void syncRoomToRtdb(room, await getRoomPlayers(room.id));
      const res: JoinResponse = {
        ok: true,
        code,
        playerId: updated.id,
        token: updated.token,
        name: updated.name,
        color: updated.color,
        isHost: updated.isHost,
        photo: updated.photo,
      };
      return NextResponse.json(res);
    }
  }

  // Jugador nuevo: el nombre no puede estar en uso (ya no hay contraseña para reclamarlo)
  const nameInUse = current.some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (nameInUse) {
    return err(
      hasAccount
        ? `"${name}" ya lo usa otro jugador en esta sala. Elige otro nombre.`
        : `"${name}" ya está en uso en esta sala. Elige otro para entrar.`,
      409,
    );
  }

  const roomMax = Math.min(MAX_PLAYERS, room.maxPlayers);
  if (current.length >= roomMax) return err(`La sala está llena (máximo ${roomMax} jugadores)`, 403);

  const takenColors = new Set(current.map((p) => p.color));
  const color =
    validWantedColor && !takenColors.has(validWantedColor)
      ? validWantedColor
      : (PLAYER_COLORS.find((c) => !takenColors.has(c.value))?.value ?? PLAYER_COLORS[0].value);

  const [player] = await db
    .insert(players)
    .values({
      roomId: room.id,
      name: cloudProfile?.name || name,
      passHash: "",
      uid,
      photo,
      color: cloudProfile?.color || color,
      level: cloudProfile?.stats?.level ?? 1,
      xp: cloudProfile?.stats?.xp ?? 0,
    })
    .returning();

  void syncRoomToRtdb(room, await getRoomPlayers(room.id));
  const res: JoinResponse = {
    ok: true,
    code,
    playerId: player.id,
    token: player.token,
    name: player.name,
    color: player.color,
    isHost: false,
    photo: player.photo,
  };
  return NextResponse.json(res);
}
