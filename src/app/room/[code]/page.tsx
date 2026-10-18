"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Cloud,
  Copy,
  Crown,
  Dices,
  DoorOpen,
  Eye,
  FastForward,
  Globe2,
  Lock,
  Palette,
  Play,
  RotateCcw,
  Send,
  Users,
  UserX,
  ShieldBan,
  Wifi,
} from "lucide-react";
import GameField, { type FieldPlayer } from "@/components/GameField";
import Hangman from "@/components/Hangman";
import JoinRoomPanel from "@/components/JoinRoomPanel";
import ResultOverlay from "@/components/ResultOverlay";
import ColorPicker from "@/components/ColorPicker";
import { Spinner, useToasts } from "@/components/ui";
import { burstConfetti } from "@/lib/confetti";
import { clearSession, loadSession } from "@/lib/session";
import { displayName, isValidWord, normalizeWord, PLAYER_COLORS } from "@/lib/game";
import { subscribeRoomRtdb, useFirebaseUser } from "@/lib/firebase";
import { recordGameResult } from "@/lib/profile";
import type { RoomStateDTO } from "@/lib/dto";

const pageAnim = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: { duration: 0.3, ease: "easeOut" as const },
};

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { push, stack } = useToasts();

  const [state, setState] = useState<RoomStateDTO | null>(null);
  const [gone, setGone] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [wordDraft, setWordDraft] = useState("");
  const [hintDraft, setHintDraft] = useState("");
  const [showWord, setShowWord] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [lobbyTab, setLobbyTab] = useState<"players" | "custom">("players");
  const [liveSync, setLiveSync] = useState(false);

  const inFlight = useRef(false);
  const celebratedRef = useRef(0);
  const statsRef = useRef(0);
  const failsRef = useRef<{ round: number; fails: number }>({ round: -1, fails: 0 });
  const { user: fbUser } = useFirebaseUser();

  /* ------------------------------- polling ------------------------------- */
  const fetchState = useCallback(async () => {
    const s = loadSession(code);
    if (!s) {
      setNeedsAuth(true);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/rooms/${code}/state?playerId=${encodeURIComponent(s.playerId)}&token=${encodeURIComponent(s.token)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.status === 404) {
        setGone(true);
        clearSession(code);
        return;
      }
      if (res.status === 401 || !data?.ok) {
        setNeedsAuth(true);
        return;
      }
      setState(data.state as RoomStateDTO);
      setNeedsAuth(false);
    } catch {
      /* reintenta en el siguiente tick */
    } finally {
      inFlight.current = false;
    }
  }, [code]);

  useEffect(() => {
    void fetchState();

    // Tiempo real con Realtime Database: en cuanto alguien juega, RTDB avisa y
    // pedimos el estado completo (el servidor aplica los permisos de cada quien).
    let cancelled = false;
    let unsub: (() => void) | null = null;
    let firstSnapshot = true;
    void subscribeRoomRtdb(code, () => {
      if (cancelled) return;
      if (firstSnapshot) {
        firstSnapshot = false; // el primer snapshot llega al suscribirse
        return;
      }
      setLiveSync(true);
      void fetchState();
    }).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });

    // Sondeo de respaldo (por si RTDB no está disponible o hay reglas cerradas)
    const t = window.setInterval(fetchState, 3500);
    return () => {
      cancelled = true;
      unsub?.();
      window.clearInterval(t);
    };
  }, [fetchState, code]);

  /* ------------------------------- acciones ------------------------------ */
  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const s = loadSession(code);
      if (!s) {
        setNeedsAuth(true);
        return false;
      }
      try {
        const res = await fetch(`/api/rooms/${code}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: s.playerId, token: s.token, action, ...extra }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          push(data?.error ?? "Algo salió mal");
          return false;
        }
        if (data.event === "left" || data.event === "room-closed") {
          clearSession(code);
          router.push("/");
          return true;
        }
        if (data.state) setState(data.state as RoomStateDTO);
        return true;
      } catch {
        push("Sin conexión. Revisa tu red.");
        return false;
      }
    },
    [code, push, router],
  );

  /* ---------------------------- efectos visuales -------------------------- */
  useEffect(() => {
    if (!state) return;
    // confeti una vez por ronda ganada
    if (state.status === "finished" && state.winner === "guessers" && celebratedRef.current !== state.round) {
      celebratedRef.current = state.round;
      void burstConfetti(state.players.map((p) => p.color));
    }
    // sacudida cuando sube el total de fallos
    const used = state.players.reduce((a, p) => a + p.failsUsed, 0);
    if (state.round !== failsRef.current.round) {
      failsRef.current = { round: state.round, fails: used };
    } else if (used > failsRef.current.fails) {
      setShake((s) => s + 1);
      failsRef.current.fails = used;
    }
    // registrar estadísticas de la ronda en Firestore (perfil en la nube)
    if (state.status === "finished" && state.winner && statsRef.current !== state.round) {
      statsRef.current = state.round;
      const meP = state.players.find((p) => p.id === state.me);
      if (fbUser && meP) {
        const won =
          (state.winner === "guessers" && meP.role === "guesser") ||
          (state.winner === "writer" && meP.role === "writer");
        void recordGameResult({
          uid: fbUser.uid,
          role: meP.role as "guesser" | "writer",
          won,
          lettersGuessed: meP.role === "guesser"
            ? state.guessed.split("").filter((c) => state.word?.includes(c)).length
            : undefined,
          lettersMissed: meP.role === "guesser" ? meP.failsUsed : undefined,
          wordLength: state.word?.length,
          failsUsed: meP.failsUsed,
          failsTotal: meP.failsTotal,
        });
      }
    }
  }, [state, fbUser]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      push("No se pudo copiar");
    }
  };

  /* --------------------------------- datos -------------------------------- */
  const mePlayer = state?.players.find((p) => p.id === state.me) ?? null;
  const fieldPlayers: FieldPlayer[] =
    state?.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      role: p.role,
      failsUsed: p.failsUsed,
      failsTotal: p.failsTotal,
      status: p.status,
      isHost: p.isHost,
      online: p.online,
      isMe: p.id === state.me,
      level: p.level,
      xp: p.xp,
      rankEmoji: p.rankEmoji,
      rankColor: p.rankColor,
    })) ?? [];

  const isMyTurn = !!state && state.status === "playing" && state.currentTurnId === state.me && mePlayer?.status === "alive";
  const canPlay = !!state && state.status === "playing" && (!!isMyTurn || (!!mePlayer && mePlayer.role === "writer"));

  const waitingLabel = !mePlayer
    ? "…"
    : mePlayer.role === "writer"
      ? "Tú escribiste la palabra. Mira cómo la descifran…"
      : mePlayer.status === "hung"
        ? "Quedaste ahorcado. Espera la siguiente ronda…"
        : `${state?.players.find((p) => p.id === state.currentTurnId)?.name ?? "Alguien"} está pensando…`;

  const submitWord = async () => {
    const w = normalizeWord(wordDraft);
    if (!isValidWord(w)) return push("La palabra debe tener entre 2 y 24 letras (solo letras)");
    setBusy(true);
    const ok = await act("submitWord", { word: w, hint: hintDraft });
    if (ok) {
      setWordDraft("");
      setHintDraft("");
      setShowWord(false);
    }
    setBusy(false);
  };

  /* --------------------------------- vistas -------------------------------- */
  if (gone) {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <div className="chalk-card p-8">
          <h1 className="hand text-5xl font-bold text-glow">La sala se cerró</h1>
          <p className="mt-3 text-sm font-bold text-chalk-dim">El anfitrión se fue o la sala expiró.</p>
          <Link href="/" className="btn-chalk btn-fill mt-6 px-6 py-3 text-xl hand" style={{ ["--btn-color" as never]: "#FFD93D" }}>
            <DoorOpen className="w-5 h-5" /> Volver al menú
          </Link>
        </div>
        {stack}
      </main>
    );
  }

  if (needsAuth) {
    return (
      <JoinRoomPanel
        code={code}
        onJoined={() => {
          setNeedsAuth(false);
          void fetchState();
        }}
      />
    );
  }

  if (!state) {
    return (
      <main className="pt-20">
        <Spinner label={`Buscando la sala ${code}…`} />
        {stack}
      </main>
    );
  }

  const host = state.players.find((p) => p.isHost);
  const writerDraft = state.players.find((p) => p.id === state.writerId) ?? null;

  return (
    <main className="relative mx-auto max-w-5xl px-4 pb-16 pt-6">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <span className="chip text-sm">
            Sala{" "}
            <b className="hand text-2xl text-sun tracking-[0.25em] leading-none">{state.code}</b>
          </span>
          <button type="button" className="btn-chalk p-2" style={{ ["--btn-color" as never]: "#b9b4a6" }} title="Copiar código" onClick={() => void copy()}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {liveSync && (
            <span className="chip" title="Sincronización en vivo con Realtime Database">
              <span className="w-2 h-2 rounded-full bg-mint animate-pulse" /> En vivo
            </span>
          )}
          {state.round > 0 && <span className="chip">Ronda {state.round}</span>}
          <button
            type="button"
            className="btn-chalk px-3.5 py-2 text-sm"
            style={{ ["--btn-color" as never]: "#FF6B6B" }}
            onClick={() => {
              if (window.confirm("¿Salir de la sala? Con tu cuenta de Google puedes volver a entrar cuando quieras.")) void act("leave");
            }}
          >
            <DoorOpen className="w-4 h-4" /> Salir
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* -------------------------------- LOBBY -------------------------------- */}
        {(state.status === "lobby" || state.status === "finished") && (
          <motion.section key="lobby" {...pageAnim} className="mx-auto max-w-xl grid gap-4">
            {/* Secciones del lobby */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/25 border-2 border-chalk/10">
              {(
                [
                  ["players", "Jugadores", Users],
                  ["custom", "Personalizar", Palette],
                ] as const
              ).map(([t, label, Icon]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLobbyTab(t)}
                  className={`hand flex items-center justify-center gap-2 rounded-xl py-2.5 text-xl font-bold transition-all ${
                    lobbyTab === t ? "bg-chalk/15 text-chalk" : "text-chalk-dim hover:text-chalk"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>

            {lobbyTab === "players" ? (
              <div className="chalk-card p-5 grid gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="hand text-4xl font-bold leading-none">
                    Jugadores <span className="text-chalk-dim text-2xl">({state.players.length}/{state.maxPlayers})</span>
                  </h2>
                  <button
                    type="button"
                    disabled={!state.isHost}
                    onClick={() =>
                      void act("setVisibility", {
                        visibility: state.visibility === "public" ? "private" : "public",
                      })
                    }
                    className="chip disabled:opacity-70"
                    title={state.isHost ? "Cambiar entre pública y privada" : undefined}
                  >
                    {state.visibility === "public" ? (
                      <>
                        <Globe2 className="w-3.5 h-3.5 text-mint" /> Pública
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-sun" /> Privada
                      </>
                    )}
                  </button>
                </div>

                <ul className="grid gap-2">
                  <AnimatePresence>
                    {state.players.map((p) => (
                      <motion.li
                        key={p.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className="flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5"
                        style={{ borderColor: `${p.color}55`, background: `${p.color}0d` }}
                      >
                        {p.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.photo}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full shrink-0 border-2"
                            style={{ borderColor: p.color }}
                          />
                        ) : (
                          <span
                            className="w-7 h-7 rounded-full shrink-0 grid place-items-center hand text-lg font-bold"
                            style={{ background: `${p.color}26`, border: `2px solid ${p.color}`, color: p.color }}
                          >
                            {p.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="font-extrabold truncate block" style={{ color: p.color }}>
                            {p.name}
                            {p.id === state.me && <span className="text-chalk-dim font-bold"> (tú)</span>}
                          </span>
                          <span className="text-[0.65rem] font-bold block leading-tight opacity-90" style={{ color: p.rankColor ?? "#b9b4a6" }}>
                            {p.rankEmoji} {p.rankName} · Niv. {p.level} · {p.xp} XP
                          </span>
                        </span>
                        {p.isHost && <Crown className="w-4 h-4 text-sun shrink-0" />}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${p.online ? "bg-mint" : "bg-coral"}`}
                          title={p.online ? "conectado" : "desconectado"}
                        />
                        {state.isHost && p.id !== state.me && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className="text-chalk-dim hover:text-coral transition-colors"
                              title={`Expulsar a ${p.name}`}
                              onClick={() => {
                                if (window.confirm(`¿Expulsar a ${p.name}?`)) void act("kick", { targetId: p.id });
                              }}
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="text-chalk-dim hover:text-coral transition-colors"
                              title={`Vetar a ${p.name} (no podrá volver)`}
                              onClick={() => {
                                if (window.confirm(`¿Vetar a ${p.name}? Ya no podrá volver a entrar a esta sala.`)) void act("ban", { targetId: p.id });
                              }}
                            >
                              <ShieldBan className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                {state.isHost ? (
                  <>
                    {/* Máximo de jugadores */}
                    <div className="flex items-center justify-between gap-3 chalk-dashed px-4 py-3">
                      <span className="text-sm font-bold text-chalk-dim flex items-center gap-1.5">
                        <Users className="w-4 h-4" /> Máx. jugadores
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-chalk px-2.5 py-1 text-lg hand"
                          style={{ ["--btn-color" as never]: "#b9b4a6" }}
                          disabled={state.maxPlayers <= 2}
                          onClick={() => void act("setMaxPlayers", { maxPlayers: state.maxPlayers - 1 })}
                        >
                          −
                        </button>
                        <span className="hand text-2xl font-bold w-8 text-center">{state.maxPlayers}</span>
                        <button
                          type="button"
                          className="btn-chalk px-2.5 py-1 text-lg hand"
                          style={{ ["--btn-color" as never]: "#b9b4a6" }}
                          disabled={state.maxPlayers >= 11}
                          onClick={() => void act("setMaxPlayers", { maxPlayers: state.maxPlayers + 1 })}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-chalk btn-fill py-3.5 text-2xl hand"
                      style={{ ["--btn-color" as never]: "#6BCB77" }}
                      disabled={state.players.length < 2 || busy}
                      onClick={async () => {
                        setBusy(true);
                        await act("start");
                        setBusy(false);
                      }}
                    >
                      <Play className="w-5 h-5" /> ¡Empezar!
                    </button>
                    <p className="text-xs font-bold text-chalk-dim flex items-center gap-2 -mt-1">
                      <Dices className="w-4 h-4 text-sun shrink-0" />
                      {state.players.length < 2
                        ? "Faltan jugadores: uno escribe y el resto adivina."
                        : `El sistema elige al azar quién escribe · 10 vidas entre ${state.players.length - 1}.`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-chalk-dim text-center py-1">
                    Esperando a <b style={{ color: host?.color }}>{host?.name ?? "el anfitrión"}</b>…
                  </p>
                )}
              </div>
            ) : (
              <div className="chalk-card p-5 grid gap-4">
                <h2 className="hand text-4xl font-bold leading-none">Tu personaje</h2>
                <div className="flex items-center gap-4">
                  <Hangman
                    color={mePlayer?.color ?? PLAYER_COLORS[0].value}
                    failsUsed={10}
                    failsTotal={10}
                    mood="happy"
                    className="w-24 h-28 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="hand text-4xl leading-none truncate" style={{ color: mePlayer?.color }}>
                      {mePlayer?.name}
                    </p>
                    <p className="text-xs font-bold text-chalk-dim mt-1.5">
                      Así te verán los demás en la pizarra.
                    </p>
                  </div>
                </div>
                <ColorPicker
                  value={mePlayer?.color ?? PLAYER_COLORS[0].value}
                  onChange={(c) => void act("setColor", { color: c })}
                  taken={state.players.filter((p) => p.id !== state.me).map((p) => p.color)}
                  label="Color de tu tiza en esta sala"
                />
              </div>
            )}

            {/* Invitación */}
            <div className="chalk-card px-5 py-4 text-center grid gap-2.5">
              <p className="text-[0.68rem] font-extrabold tracking-[0.3em] text-chalk-dim">CÓDIGO DE LA SALA</p>
              <button
                type="button"
                onClick={() => void copy()}
                className="hand text-6xl font-bold tracking-[0.25em] text-sun text-glow hover:opacity-80 transition-opacity"
                title="Tocar para copiar"
              >
                {state.code}
              </button>
              <div className="flex justify-center gap-2">
                <button type="button" className="btn-chalk px-4 py-2 text-sm" style={{ ["--btn-color" as never]: "#b9b4a6" }} onClick={() => void copy()}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copiar código
                </button>
              </div>
              <p className="text-[0.72rem] font-bold text-chalk-dim flex items-center justify-center gap-1.5">
                {state.network === "lan" ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-mint" /> Misma Wi-Fi: que abran esta dirección
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-cyan-chalk" /> Comparte el código con tus amigos para que entren
                  </>
                )}
              </p>
            </div>
          </motion.section>
        )}

        {/* ------------------------------- ESCRIBIENDO ------------------------------- */}
        {state.status === "writing" && (
          <motion.section key="writing" {...pageAnim} className="mx-auto max-w-xl">
            {mePlayer?.role === "writer" ? (
              <div className="chalk-card p-6">
                <h2 className="hand text-5xl font-bold text-glow text-center">Te toca escribir</h2>
                <p className="text-center text-sm font-bold text-chalk-dim mt-2 mb-5">
                  Elige la palabra que intentarán adivinar. ¡Que nadie la vea!
                </p>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-bold text-chalk-dim mb-1.5 block">Palabra secreta</label>
                    <div className="relative">
                      <input
                        className="input-chalk tracking-[0.3em] uppercase pr-12 text-center"
                        type={showWord ? "text" : "password"}
                        placeholder="ESCRÍBELA AQUÍ"
                        value={wordDraft}
                        maxLength={24}
                        autoFocus
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(e) => setWordDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void submitWord()}
                      />
                      <button
                        type="button"
                        aria-label="Mostrar palabra"
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${showWord ? "text-sun" : "text-chalk-dim"}`}
                        onClick={() => setShowWord((s) => !s)}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-chalk-dim mb-1.5 block">Pista (opcional)</label>
                    <input
                      className="input-chalk"
                      placeholder="p. ej. una fruta, un país…"
                      value={hintDraft}
                      maxLength={60}
                      autoComplete="off"
                      onChange={(e) => setHintDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void submitWord()}
                    />
                  </div>
                  <p className="text-xs font-bold text-chalk-dim chalk-dashed px-4 py-3">
                    Reparto de las 10 vidas:{" "}
                    <span className="text-chalk">
                      {state.players
                        .filter((p) => p.role === "guesser")
                        .map((p) => `${p.name} ${p.failsTotal}`)
                        .join(" · ")}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="btn-chalk btn-fill py-3.5 text-3xl hand"
                    style={{ ["--btn-color" as never]: "#6BCB77" }}
                    disabled={busy}
                    onClick={() => void submitWord()}
                  >
                    <Send className="w-5 h-5" /> ¡Que la adivinen!
                  </button>
                </div>
              </div>
            ) : (
              <div className="chalk-card p-8 text-center">
                <div className="flex justify-center mb-4">
                  <Hangman color={writerDraft?.color ?? "#f2efe6"} failsUsed={0} failsTotal={10} mood="normal" className="w-28 h-32 animate-wiggle" />
                </div>
                <h2 className="hand text-5xl font-bold text-glow">
                  <span style={{ color: writerDraft?.color }}>{writerDraft?.name ?? "El escritor"}</span> está pensando
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                  >
                    …
                  </motion.span>
                </h2>
                <p className="mt-3 text-sm font-bold text-chalk-dim">
                  En cuanto escriba la palabra comienzan los turnos. Tus vidas esta ronda:{" "}
                  <b className="text-chalk">{mePlayer?.failsTotal ?? "?"}</b>
                </p>
              </div>
            )}
          </motion.section>
        )}

        {/* --------------------------------- JUGANDO -------------------------------- */}
        {state.status === "playing" && (
          <motion.section key="playing" {...pageAnim}>
            {state.isHost && (
              <div className="flex justify-center gap-2.5 mb-4">
                <button
                  type="button"
                  className="btn-chalk px-4 py-2 text-sm"
                  style={{ ["--btn-color" as never]: "#FFD93D" }}
                  onClick={() => void act("skipTurn")}
                  title="Pasar el turno al siguiente (por si alguien se durmió)"
                >
                  <FastForward className="w-4 h-4" /> Saltar turno
                </button>
                <button
                  type="button"
                  className="btn-chalk px-4 py-2 text-sm"
                  style={{ ["--btn-color" as never]: "#FF6B6B" }}
                  onClick={() => {
                    if (window.confirm("¿Cancelar la ronda y volver a la sala?")) void act("restart");
                  }}
                >
                  <RotateCcw className="w-4 h-4" /> Cancelar ronda
                </button>
              </div>
            )}
            <GameField
              players={fieldPlayers}
              masked={state.masked ?? []}
              guessed={state.guessed}
              hint={state.hint}
              currentTurnId={state.currentTurnId}
              lastEvent={state.lastEvent}
              canPlay={canPlay}
              hideKeyboard={mePlayer?.role === "writer"}
              waitingLabel={waitingLabel}
              onGuess={(v) => void act("guess", { value: v })}
              shakeKey={shake}
              headerExtra={
                mePlayer?.role === "writer" && state.word ? (
                  <span className="chip" style={{ borderColor: "#6bcb7788", color: "#6bcb77" }}>
                    Tu palabra: <b className="tracking-[0.2em]">{state.word}</b>
                  </span>
                ) : undefined
              }
            />
          </motion.section>
        )}
      </AnimatePresence>

      {/* -------------------------------- RESULTADOS -------------------------------- */}
      {state.status === "finished" && state.winner && state.word && (
        <ResultOverlay winner={state.winner} word={state.word} writerName={displayName(writerDraft?.name ?? "El escritor") || "El escritor"} players={fieldPlayers}>
          {state.isHost ? (
            <button
              type="button"
              className="btn-chalk btn-fill px-6 py-3 text-2xl hand"
              style={{ ["--btn-color" as never]: "#6BCB77" }}
              onClick={() => void act("restart")}
            >
              <RotateCcw className="w-5 h-5" /> Otra ronda
            </button>
          ) : (
            <p className="text-sm font-bold text-chalk-dim self-center">Esperando a que el anfitrión arme otra ronda…</p>
          )}
          <button
            type="button"
            className="btn-chalk px-6 py-3 text-2xl hand"
            style={{ ["--btn-color" as never]: "#FF6B6B" }}
            onClick={() => void act("leave")}
          >
            <DoorOpen className="w-5 h-5" /> Salir de la sala
          </button>
        </ResultOverlay>
      )}

      {stack}
    </main>
  );
}
