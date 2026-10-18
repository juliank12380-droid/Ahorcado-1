"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Dices, Eye, Pencil, Plus, Smartphone, Sparkles, Users, X } from "lucide-react";
import GameField, { type FieldPlayer } from "@/components/GameField";
import Hangman from "@/components/Hangman";
import ResultOverlay from "@/components/ResultOverlay";
import TurnBanner from "@/components/TurnBanner";
import { useToasts } from "@/components/ui";
import { burstConfetti } from "@/lib/confetti";
import {
  applyGuess,
  calcRoundPoints,
  displayName,
  distributeLives,
  isValidWord,
  maskWord,
  normalizeWord,
  PLAYER_COLORS,
  TOTAL_LIVES,
  type EngineState,
} from "@/lib/game";
import SessionScoreboard from "@/components/SessionScoreboard";

interface LocalPlayer {
  id: string;
  name: string;
  color: string;
  /** Puntos acumulados durante esta sesión local. */
  sessionPoints: number;
}

type Stage = "setup" | "reveal" | "word" | "play";

const uid = () => Math.random().toString(36).slice(2, 10);
const MAX_PLAYERS = 11;

/** Color automático: el sistema reparte la paleta, nadie elige. */
const colorFor = (index: number) => PLAYER_COLORS[(index + 1) % PLAYER_COLORS.length].value;

const pageAnim = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.3, ease: "easeOut" as const },
};

export default function LocalPage() {
  const { push, stack } = useToasts();
  const [stage, setStage] = useState<Stage>("setup");
  const [players, setPlayers] = useState<LocalPlayer[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [writerId, setWriterId] = useState<string | null>(null);
  const [lastWriterId, setLastWriterId] = useState<string | null>(null);
  const [wordInput, setWordInput] = useState("");
  const [hintInput, setHintInput] = useState("");
  const [roundHint, setRoundHint] = useState<string | null>(null);
  const [showWord, setShowWord] = useState(false);
  const [round, setRound] = useState(0);
  const [game, setGame] = useState<EngineState | null>(null);
  const [bannerFor, setBannerFor] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [celebrated, setCelebrated] = useState(false);

  const writer = players.find((p) => p.id === writerId) ?? null;
  const guessersPreview = players.filter((p) => p.id !== writerId);
  const livesPreview = useMemo(
    () => distributeLives(Math.max(guessersPreview.length, 1)),
    [guessersPreview.length],
  );

  const addPlayer = () => {
    const name = displayName(nameInput);
    if (name.length < 2) return push("Escribe un nombre de al menos 2 letras");
    if (players.length >= MAX_PLAYERS) return push(`Máximo ${MAX_PLAYERS} jugadores`);
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return push("Ese nombre ya está en la lista");
    setPlayers((ps) => [...ps, { id: uid(), name, color: colorFor(ps.length), sessionPoints: 0 }]);
    setNameInput("");
  };

  /** El sistema sortea quién escribe (evita repetir al anterior para que rote). */
  const pickWriter = (list: LocalPlayer[], avoid: string | null): LocalPlayer => {
    let pool = list;
    if (avoid) {
      const filtered = list.filter((p) => p.id !== avoid);
      if (filtered.length > 0) pool = filtered;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const startRound = (list = players, avoid = lastWriterId) => {
    if (list.length < 2) return push("Agrega al menos 2 jugadores");
    const chosen = pickWriter(list, avoid);
    setWriterId(chosen.id);
    setWordInput("");
    setHintInput("");
    setShowWord(false);
    setGame(null);
    setStage("reveal");
  };

  const submitWord = () => {
    const word = normalizeWord(wordInput);
    if (!isValidWord(word)) return push("La respuesta debe tener entre 2 y 32 letras. Puedes usar espacios.");
    const guessers = players.filter((p) => p.id !== writerId);
    const lives = distributeLives(guessers.length);
    const enginePlayers = guessers.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      role: "guesser" as const,
      failsUsed: 0,
      failsTotal: lives[i],
      status: "alive" as const,
    }));
    setGame({
      status: "playing",
      word,
      guessed: "",
      players: enginePlayers,
      currentTurnId: enginePlayers[0]?.id ?? null,
      winner: null,
    });
    setRound((r) => r + 1);
    setLastWriterId(writerId);
    setRoundHint(hintInput.trim() || null);
    setCelebrated(false);
    setShake(0);
    setLastEvent(null);
    setBannerFor(enginePlayers[0]?.id ?? null);
    setWordInput("");
    setHintInput("");
    setShowWord(false);
    setStage("play");
  };

  const onGuess = (value: string) => {
    if (!game || game.status !== "playing" || bannerFor) return;
    const st = structuredClone(game);
    const me = st.players.find((p) => p.id === st.currentTurnId);
    if (!me) return;
    const prevTurn = st.currentTurnId;
    const res = applyGuess(st, me.id, value);
    if (!res.ok) return push(res.error);
    const norm = normalizeWord(value);

    if (res.kind === "letter-hit") setLastEvent(`¡${me.name} acertó la ${norm}! Sigue jugando`);
    if (res.kind === "letter-miss") {
      setShake((s) => s + 1);
      setLastEvent(me.status === "hung" ? `${me.name} falló la ${norm}… y quedó ahorcado` : `${me.name} falló con la ${norm} (−1 vida)`);
    }
    if (res.kind === "word-miss") {
      setShake((s) => s + 1);
      setLastEvent(me.status === "hung" ? `${me.name} arriesgó «${norm}», falló y quedó ahorcado` : `${me.name} arriesgó «${norm}» y falló (−2 vidas)`);
    }
    if (res.kind === "word-hit") setLastEvent(`¡${me.name} descifró la palabra!`);

    setGame(st);

    if (st.status === "finished") {
      setLastEvent(st.winner === "guessers" ? "¡Ganan los adivinadores!" : `Todos ahorcados. ¡Gana ${writer?.name ?? "el escritor"}!`);

      // Sumar puntos de sesión a TODOS los jugadores locales.
      const guessersHung = st.players.filter(
        (p) => p.role === "guesser" && p.status === "hung",
      ).length;

      setPlayers((prev) =>
        prev.map((pl) => {
          if (pl.id === writer?.id) {
            const pts = calcRoundPoints({
              role: "writer",
              won: st.winner === "writer",
              failsUsed: 0,
              failsTotal: 0,
              guessersHung,
            });
            return { ...pl, sessionPoints: pl.sessionPoints + pts };
          }

          const gp = st.players.find((p) => p.id === pl.id);
          if (!gp) return pl;
          const pts = calcRoundPoints({
            role: "guesser",
            won: st.winner === "guessers",
            failsUsed: gp.failsUsed,
            failsTotal: gp.failsTotal,
          });
          return { ...pl, sessionPoints: pl.sessionPoints + pts };
        }),
      );

      if (st.winner === "guessers" && !celebrated) {
        setCelebrated(true);
        void burstConfetti(players.map((p) => p.color));
      }
    } else if (st.currentTurnId && st.currentTurnId !== prevTurn) {
      setBannerFor(st.currentTurnId);
    }
  };

  const bannerPlayer = game?.players.find((p) => p.id === bannerFor) ?? null;

  const fieldPlayers: FieldPlayer[] = useMemo(() => {
    if (!game || !writer) return [];
    return [
      {
        id: writer.id,
        name: writer.name,
        color: writer.color,
        role: "writer" as const,
        failsUsed: 0,
        failsTotal: 0,
        status: "alive" as const,
      },
      ...game.players,
    ];
  }, [game, writer]);

  return (
    <main className="relative mx-auto max-w-3xl px-4 pb-16 pt-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link href="/" className="btn-chalk px-3.5 py-2 text-sm" style={{ ["--btn-color" as never]: "#b9b4a6" }}>
          <ArrowLeft className="w-4 h-4" /> Menú
        </Link>
        <span className="chip">
          <Smartphone className="w-3.5 h-3.5" /> Un solo teléfono{round > 0 ? ` · Ronda ${round}` : ""}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {/* ------------------------------- JUGADORES ------------------------------- */}
        {stage === "setup" && (
          <motion.section key="setup" {...pageAnim} className="mx-auto max-w-md">
            <h1 className="hand text-5xl font-bold text-glow text-center leading-none">¿Quiénes juegan?</h1>
            <p className="text-center text-chalk-dim font-bold mt-2 text-sm">
              Escribe los nombres. El sistema elige quién escribe la palabra.
            </p>

            <div className="chalk-card p-5 mt-5 grid gap-4">
              <div className="flex gap-2">
                <input
                  className="input-chalk"
                  placeholder="Nombre del jugador"
                  value={nameInput}
                  maxLength={16}
                  autoComplete="off"
                  autoFocus
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                />
                <button type="button" className="btn-chalk btn-fill px-4" style={{ ["--btn-color" as never]: "#6BCB77" }} onClick={addPlayer}>
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {players.length > 0 && (
                <ul className="grid gap-2">
                  <AnimatePresence>
                    {players.map((p, i) => (
                      <motion.li
                        key={p.id}
                        layout
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5"
                        style={{ borderColor: `${p.color}55`, background: `${p.color}0d` }}
                      >
                        <span className="hand text-xl w-5 text-center shrink-0" style={{ color: p.color }}>
                          {i + 1}
                        </span>
                        <span className="font-extrabold truncate flex-1" style={{ color: p.color }}>
                          {p.name}
                        </span>
                        <button
                          type="button"
                          aria-label={`Quitar a ${p.name}`}
                          className="text-chalk-dim hover:text-coral transition-colors"
                          onClick={() =>
                            setPlayers((ps) =>
                              ps
                                .filter((x) => x.id !== p.id)
                                .map((x, idx) => ({ ...x, color: colorFor(idx) })),
                            )
                          }
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}

              <p className="text-xs font-bold text-chalk-dim flex items-center gap-2">
                <Dices className="w-4 h-4 text-sun shrink-0" />
                {players.length < 2
                  ? "Mínimo 2 jugadores: uno escribe y el resto adivina."
                  : `Las ${TOTAL_LIVES} vidas se reparten entre los ${players.length - 1} que adivinan.`}
              </p>

              <button
                type="button"
                className="btn-chalk btn-fill py-3.5 text-2xl hand"
                style={{ ["--btn-color" as never]: "#FFD93D" }}
                disabled={players.length < 2}
                onClick={() => startRound()}
              >
                <Dices className="w-5 h-5" /> ¡A jugar!
              </button>
            </div>
          </motion.section>
        )}

        {/* ---------------------- EL SISTEMA ELIGE AL ESCRITOR ---------------------- */}
        {stage === "reveal" && writer && (
          <motion.section key="reveal" {...pageAnim} className="mx-auto max-w-md">
            <button type="button" className="chalk-card w-full p-8 text-center grid gap-4" onClick={() => setStage("word")}>
              <p className="hand text-3xl text-chalk-dim leading-none">El sistema eligió…</p>
              <motion.p
                initial={{ scale: 0.5, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 14 }}
                className="hand text-7xl font-bold text-glow leading-none"
                style={{ color: writer.color }}
              >
                {writer.name}
              </motion.p>
              <p className="text-sm font-bold text-chalk-dim">
                Pásale el teléfono: le toca <b className="text-chalk">escribir la palabra</b> a escondidas.
              </p>
              <span className="btn-chalk btn-fill py-3 text-xl hand mt-1" style={{ ["--btn-color" as never]: writer.color }}>
                Soy {writer.name}, continuar
              </span>
            </button>
          </motion.section>
        )}

        {/* --------------------------------- PALABRA --------------------------------- */}
        {stage === "word" && writer && (
          <motion.section key="word" {...pageAnim} className="mx-auto max-w-md">
            <h1 className="hand text-5xl font-bold text-glow text-center leading-none" style={{ color: writer.color }}>
              {writer.name}
            </h1>
            <p className="text-center text-chalk-dim font-bold mt-2 text-sm">Escribe la palabra secreta. ¡Que nadie mire!</p>

            <div className="chalk-card p-5 mt-5 relative overflow-hidden">
              <div className="absolute -right-5 -bottom-7 opacity-20 pointer-events-none rotate-12">
                <Hangman color={writer.color} failsUsed={0} failsTotal={10} className="w-36 h-44" glow={false} />
              </div>
              <div className="relative grid gap-4">
                <div className="relative">
                  <input
                    className="input-chalk tracking-[0.3em] uppercase pr-12 text-center"
                    type={showWord ? "text" : "password"}
                    placeholder="PALABRA O FRASE"
                    value={wordInput}
                    maxLength={40}
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => setWordInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitWord()}
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
                <input
                  className="input-chalk"
                  placeholder="Pista (opcional)"
                  value={hintInput}
                  maxLength={60}
                  autoComplete="off"
                  onChange={(e) => setHintInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitWord()}
                />
                <p className="text-xs font-bold text-chalk-dim chalk-dashed px-4 py-2.5">
                  Vidas: <span className="text-chalk">{guessersPreview.map((p, i) => `${p.name} ${livesPreview[i]}`).join(" · ")}</span>
                </p>
                <button
                  type="button"
                  className="btn-chalk btn-fill py-3.5 text-2xl hand"
                  style={{ ["--btn-color" as never]: "#6BCB77" }}
                  onClick={submitWord}
                >
                  <Pencil className="w-5 h-5" /> ¡Listo, que adivinen!
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {/* ---------------------------------- JUEGO ---------------------------------- */}
        {stage === "play" && game && (
          <motion.section key="play" {...pageAnim}>
            <GameField
              players={fieldPlayers}
              masked={maskWord(game.word ?? "", game.guessed)}
              guessed={game.guessed}
              hint={roundHint}
              currentTurnId={bannerFor ? null : game.currentTurnId}
              lastEvent={lastEvent}
              canPlay={game.status === "playing" && !bannerFor}
              waitingLabel="Preparando turno…"
              onGuess={onGuess}
              shakeKey={shake}
            />
          </motion.section>
        )}
      </AnimatePresence>

      <TurnBanner
        show={!!bannerPlayer && game?.status === "playing"}
        name={bannerPlayer?.name ?? ""}
        color={bannerPlayer?.color ?? "#f2efe6"}
        onReady={() => setBannerFor(null)}
      />

      {game?.status === "finished" && game.winner && (
        <ResultOverlay winner={game.winner} word={game.word ?? ""} writerName={writer?.name ?? "El escritor"} players={fieldPlayers}>
          <button
            type="button"
            className="btn-chalk btn-fill px-6 py-3 text-2xl hand"
            style={{ ["--btn-color" as never]: "#6BCB77" }}
            onClick={() => startRound()}
          >
            <Sparkles className="w-5 h-5" /> Otra ronda
          </button>
          <button
            type="button"
            className="btn-chalk px-6 py-3 text-2xl hand"
            style={{ ["--btn-color" as never]: "#4ECDC4" }}
            onClick={() => {
              setGame(null);
              setStage("setup");
            }}
          >
            <Users className="w-5 h-5" /> Jugadores
          </button>
          <Link href="/" className="btn-chalk px-6 py-3 text-2xl hand" style={{ ["--btn-color" as never]: "#b9b4a6" }}>
            Menú
          </Link>
        </ResultOverlay>
      )}

      {/* Marcador de puntos de sesión: también existe en modo mismo teléfono */}
      {players.some((p) => p.sessionPoints > 0) && (
        <SessionScoreboard players={players} myId={null} />
      )}

      {stack}
    </main>
  );
}
