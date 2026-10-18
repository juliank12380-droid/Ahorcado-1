import { NextResponse } from "next/server";
import { getRoomByCode, getRoomPlayers } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Datos públicos mínimos de una sala: sirven para decidir si pedir cuenta. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await getRoomByCode(code);
  if (!room) {
    return NextResponse.json({ ok: false, error: "La sala no existe" }, { status: 404 });
  }
  const rows = await getRoomPlayers(room.id);
  return NextResponse.json({
    ok: true,
    info: {
      code: room.code,
      network: room.network,
      visibility: room.visibility,
      status: room.status,
      playerCount: rows.length,
      hostName: rows.find((p) => p.isHost)?.name ?? rows[0]?.name ?? null,
    },
  });
}
