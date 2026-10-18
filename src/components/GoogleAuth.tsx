"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { signInWithGoogle, signOutFirebase, useFirebaseUser } from "@/lib/firebase";
import { useToasts } from "@/components/ui";
import type { PlayerProfileDoc } from "@/lib/profile";

/** Logotipo oficial de Google (G multicolor). */
export function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

/**
 * Panel de identidad: botón "Continuar con Google" o tarjeta del usuario
 * conectado (avatar + cerrar sesión). No se muestra si Firebase no está configurado.
 */
export default function GoogleAuthPanel({ profile }: { profile?: PlayerProfileDoc | null }) {
  const { user, loading, enabled } = useFirebaseUser();
  const { push, stack } = useToasts();
  const [busy, setBusy] = useState(false);

  if (!enabled) return null;

  const onSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      push("No se pudo iniciar sesión con Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {loading ? (
        <div className="chalk-dashed flex items-center justify-center gap-2 py-3.5 text-chalk-dim font-bold text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Conectando con Firebase…
        </div>
      ) : user ? (
        <div className="chalk-dashed flex items-center gap-3 px-4 py-3">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName ?? "Jugador"}
              className="w-10 h-10 rounded-full border-2 border-chalk/40"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="w-10 h-10 rounded-full bg-chalk/15 grid place-items-center hand text-2xl">
              {(user.displayName ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-extrabold truncate leading-tight">{user.displayName ?? "Jugador"}</p>
            <p className="text-[0.7rem] font-bold text-chalk-dim leading-tight">
              {(profile?.stats?.gamesPlayed ?? 0) > 0
                ? `Nivel ${profile?.stats?.level ?? 1} · ${profile?.stats?.gamesPlayed ?? 0} partidas · ${profile?.stats?.gamesWon ?? 0} victorias`
                : "Conectado con Google — tu progreso se guarda en la nube"}
            </p>
          </div>
          <button
            type="button"
            className="btn-chalk p-2"
            style={{ ["--btn-color" as never]: "#FF6B6B" }}
            title="Cerrar sesión"
            onClick={() => void signOutFirebase()}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void onSignIn()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white text-slate-800 font-extrabold py-3.5 px-5 shadow-[0_12px_30px_-14px_rgba(255,255,255,0.45)] hover:bg-slate-100 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
          Continuar con Google
        </button>
      )}
      {stack}
    </div>
  );
}
