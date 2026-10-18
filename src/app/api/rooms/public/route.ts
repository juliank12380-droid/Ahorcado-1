import { NextResponse } from "next/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { players, rooms } from "@/db/schema";
import type { PublicRoomDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";

const MAX_PLAYERS = 11;
const STALE_MS = 3 * 60 * 1000; // salas sin actividad reciente no se listan

/** Buscador de partidas públicas (abiertas a cualquiera). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const network = url.searchParams.get("network");

  const since = new Date(Date.now() - STALE_MS);
  const filters = [eq(rooms.visibility, "public"), gt(rooms.updatedAt, since)];
  if (network === "lan" || network === "online") filters.push(eq(rooms.network, network));

  const roomRows = await db
    .select()
    .from(rooms)
    .where(and(...filters))
    .orderBy(desc(rooms.updatedAt))
    .limit(40);

  if (roomRows.length === 0) return NextResponse.json({ ok: true, rooms: [] });

  const playerRows = await db
    .select()
    .from(players)
    .where(
      inArray(
        players.roomId,
        roomRows.map((r) => r.id),
      ),
    );

  const now = Date.now();
  const list: PublicRoomDTO[] = roomRows
    .map((r) => {
      const ps = playerRows
        .filter((p) => p.roomId === r.id)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      const host = ps.find((p) => p.isHost) ?? ps[0];
      return {
        code: r.code,
        title: r.title ?? null,
        network: r.network as PublicRoomDTO["network"],
        status: r.status as PublicRoomDTO["status"],
        round: r.round,
        hostName: host?.name ?? "—",
        playerCount: ps.length,
        maxPlayers: Math.min(MAX_PLAYERS, r.maxPlayers),
        colors: ps.slice(0, 8).map((p) => p.color),
        updatedAgoMs: now - new Date(r.updatedAt).getTime(),
      };
    })
    .filter((r) => r.playerCount > 0);

  return NextResponse.json({ ok: true, rooms: list });
}
