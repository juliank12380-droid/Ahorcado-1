import { NextResponse } from "next/server";
import {
  authPlayer,
  buildRoomState,
  getRoomByCode,
  getRoomPlayers,
  touchPlayer,
  touchRoom,
} from "@/lib/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await getRoomByCode(code);
  if (!room) {
    return NextResponse.json({ ok: false, error: "La sala ya no existe" }, { status: 404 });
  }

  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId");
  const token = url.searchParams.get("token");

  const me = await authPlayer(room.id, playerId, token);
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "Tu sesión en esta sala ya no es válida. Entra de nuevo con el código de la sala." },
      { status: 401 },
    );
  }

  await touchPlayer(me.id);
  await touchRoom(room.id);

  const rows = await getRoomPlayers(room.id);
  return NextResponse.json({ ok: true, state: buildRoomState(room, rows, me) });
}
