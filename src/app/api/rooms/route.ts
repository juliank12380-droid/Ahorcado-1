import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players, rooms } from "@/db/schema";
import { displayName, generateRoomCode, PLAYER_COLORS } from "@/lib/game";
import { loadProfileFromFirestore } from "@/lib/firestore-server";
import { resolveIdentity } from "@/lib/identity";
import { getRoomPlayers, syncRoomToRtdb } from "@/lib/server";
import type { JoinResponse } from "@/lib/dto";

function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Crea una sala nueva; quien la crea entra como anfitrión. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    color?: string;
    idToken?: string;
    guestId?: string;
    visibility?: string;
    network?: string;
    title?: string;
    maxPlayers?: number;
  } | null;

  const name = displayName(body?.name ?? "");
  const color = PLAYER_COLORS.some((c) => c.value === body?.color)
    ? (body!.color as string)
    : PLAYER_COLORS[0].value;
  const visibility = body?.visibility === "private" ? "private" : "public";
  const network = body?.network === "lan" ? "lan" : "online";
  const title = (body?.title ?? "").trim().slice(0, 40) || null;
  const maxPlayers = Math.min(11, Math.max(2, Number(body?.maxPlayers) || 11));

  if (name.length < 2) return err("Escribe un nombre de al menos 2 letras");

  const identity = await resolveIdentity(body?.idToken, body?.guestId);
  if (!identity.ok) return err(identity.error, identity.status);

  // Salas en línea: solo con cuenta
  if (network === "online" && identity.identity.kind !== "account") {
    return err(
      "Para jugar en línea necesitas iniciar sesión. Como invitado puedes jugar en red local o en el mismo teléfono.",
      403,
    );
  }

  // Leer perfil real del usuario desde Firestore usando su propio idToken
  const cloudProfile =
    body?.idToken && identity.identity.kind === "account"
      ? await loadProfileFromFirestore(body.idToken, identity.identity.uid)
      : null;

  // BUGFIX: el nombre del perfil de Google puede ser larguísimo y columna es
  // varchar(24); sin recortar, crear sala fallaba con error 500.
  const safeName = (cloudProfile?.name ? displayName(cloudProfile.name) : "") || name;

  let roomId = "";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code = generateRoomCode(5);
    try {
      const [row] = await db
        .insert(rooms)
        .values({ code, visibility, network, title, maxPlayers })
        .returning({ id: rooms.id });
      roomId = row.id;
      break;
    } catch {
      if (i === 7) return err("No se pudo crear la sala, inténtalo de nuevo", 500);
    }
  }

  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRows[0]) return err("No se pudo crear la sala", 500);

  const [player] = await db
    .insert(players)
    .values({
      roomId,
      name: safeName,
      passHash: "",
      uid: identity.identity.uid,
      photo: identity.identity.photo,
      color: cloudProfile?.color || color,
      level: cloudProfile?.stats?.level ?? 1,
      xp: cloudProfile?.stats?.xp ?? 0,
      isHost: true,
    })
    .returning();

  void syncRoomToRtdb(roomRows[0], await getRoomPlayers(roomId));
  const res: JoinResponse = {
    ok: true,
    code,
    playerId: player.id,
    token: player.token,
    name: player.name,
    color: player.color,
    isHost: true,
    photo: player.photo,
  };
  return NextResponse.json(res);
}
