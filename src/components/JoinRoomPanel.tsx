"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cloud, Loader2, LogIn, Wifi } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import ProfileBar from "@/components/ProfileBar";
import { Spinner, useToasts } from "@/components/ui";
import { useIdentity } from "@/lib/useIdentity";
import { saveProfile, saveSession } from "@/lib/session";
import { displayName as clean } from "@/lib/game";
import type { JoinResponse, RoomNetwork } from "@/lib/dto";

interface RoomInfo {
  code: string;
  network: RoomNetwork;
  status: string;
  playerCount: number;
  hostName: string | null;
}

/** Entrada directa a una sala desde un enlace compartido (/room/CODE). */
export default function JoinRoomPanel({ code, onJoined }: { code: string; onJoined: () => void }) {
  const identity = useIdentity();
  const { push, stack } = useToasts();
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [info, setInfo] = useState<RoomInfo | null | "missing">(null);

  useEffect(() => setNameDraft(identity.displayName), [identity.displayName]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/rooms/${code}/info`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setInfo(d?.ok ? (d.info as RoomInfo) : "missing");
      })
      .catch(() => !cancelled && setInfo("missing"));
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (identity.loading || info === null) return <Spinner label="Buscando la sala…" />;

  if (info === "missing") {
    return (
      <main className="mx-auto max-w-md px-4 pt-20 text-center">
        <div className="chalk-card p-8">
          <h1 className="hand text-5xl font-bold text-glow">Sala no encontrada</h1>
          <p className="mt-3 text-sm font-bold text-chalk-dim">El código {code} ya no existe o la sala se cerró.</p>
          <Link href="/" className="btn-chalk btn-fill mt-6 px-6 py-3 text-xl hand" style={{ ["--btn-color" as never]: "#FFD93D" }}>
            Volver al menú
          </Link>
        </div>
        {stack}
      </main>
    );
  }

  // Las salas en línea exigen cuenta; las LAN quedan abiertas a invitados.
  const needsAccount = info.network === "online" && !identity.user;
  if (needsAccount) {
    return (
      <AuthGate
        onGuest={() => {
          window.location.href = "/";
        }}
        guestLabel="Volver al menú"
        notice={`La sala ${code} es en línea: necesitas una cuenta para entrar. Sin cuenta puedes jugar en el mismo teléfono o en red local.`}
      />
    );
  }

  const needsName = clean(identity.displayName).length < 2;

  const saveName = () => {
    const n = clean(nameDraft);
    if (n.length < 2) return push("Escribe un nombre de al menos 2 letras");
    identity.setDisplayName(n);
    saveProfile({ name: n });
    if (!identity.user) identity.continueAsGuest();
  };

  const join = async () => {
    setBusy(true);
    try {
      const auth = await identity.authBody();
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: identity.displayName, color: identity.color, ...auth }),
      });
      const data = (await res.json()) as JoinResponse | { ok: false; error: string };
      if (!res.ok || !data.ok) {
        push("error" in data ? data.error : "No se pudo entrar");
        return;
      }
      saveSession(data.code, { playerId: data.playerId, token: data.token, name: data.name });
      onJoined();
    } catch {
      push("Sin conexión. Revisa tu red.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-16">
      {(identity.user || identity.guest) && <ProfileBar identity={identity} />}
      <div className="chalk-card p-6 mt-5 text-center grid gap-4">
        <h1 className="hand text-4xl font-bold leading-none">Entrar a la sala</h1>
        <p className="hand text-6xl font-bold text-sun tracking-[0.25em] text-glow leading-none">{info.code}</p>
        <p className="chip mx-auto">
          {info.network === "lan" ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-mint" /> Red local
            </>
          ) : (
            <>
              <Cloud className="w-3.5 h-3.5 text-cyan-chalk" /> En línea
            </>
          )}
          {info.hostName ? ` · sala de ${info.hostName}` : ""}
        </p>

        {needsName ? (
          <div className="grid gap-2 text-left">
            <label className="text-sm font-bold text-chalk-dim">Primero elige tu nombre de jugador</label>
            <div className="flex gap-2">
              <input
                className="input-chalk"
                placeholder="Tu nombre"
                value={nameDraft}
                maxLength={16}
                autoFocus
                autoComplete="off"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
              />
              <button type="button" className="btn-chalk btn-fill px-4" style={{ ["--btn-color" as never]: "#4ECDC4" }} onClick={saveName}>
                OK
              </button>
            </div>
            <p className="text-[0.7rem] font-bold text-chalk-dim/80">
              Después lo cambias desde tu perfil.
            </p>
          </div>
        ) : (
          <p className="text-sm font-bold text-chalk-dim">
            Entrarás como <b style={{ color: identity.color }}>{identity.displayName}</b>
          </p>
        )}

        <button
          type="button"
          className="btn-chalk btn-fill py-3.5 text-2xl hand"
          style={{ ["--btn-color" as never]: "#4ECDC4" }}
          disabled={busy || needsName}
          onClick={() => void join()}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />} Entrar
        </button>
      </div>
      {stack}
    </main>
  );
}
