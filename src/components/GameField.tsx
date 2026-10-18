"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Send, Swords } from "lucide-react";
import Hangman from "@/components/Hangman";
import Keyboard from "@/components/Keyboard";
import MaskedWord from "@/components/MaskedWord";
import { TOTAL_LIVES } from "@/lib/game";

export interface FieldPlayer {
  id: string;
  name: string;
  color: string;
  role: "writer" | "guesser";
  failsUsed: number;
  failsTotal: number;
  status: "alive" | "hung";
  isHost?: boolean;
  online?: boolean;
  isMe?: boolean;
  level?: number;
  xp?: number;
  rankEmoji?: string;
  rankColor?: string;
}

export interface GameFieldProps {
  players: FieldPlayer[];
  masked: (string | null)[];
  guessed: string;
  hint: string | null;
  currentTurnId: string | null;
  lastEvent: string | null;
  canPlay: boolean;
  waitingLabel: string;
  onGuess: (value: string) => void;
  shakeKey: number;
  headerExtra?: ReactNode;
  hideKeyboard?: boolean;
  footnote?: ReactNode;
}

export default function GameField({
  players,
  masked,
  guessed,
  hint,
  currentTurnId,
  lastEvent,
  canPlay,
  waitingLabel,
  onGuess,
  shakeKey,
  headerExtra,
  hideKeyboard = false,
  footnote,
}: GameFieldProps) {
  const [risking, setRisking] = useState(false);
  const [riskValue, setRiskValue] = useState("");

  const writer = players.find((p) => p.role === "writer");
  const guessers = players.filter((p) => p.role === "guesser");
  const current = players.find((p) => p.id === currentTurnId) ?? null;
  const teamUsed = guessers.reduce((a, p) => a + p.failsUsed, 0);

  const hits = masked.filter((c): c is string => !!c).join("");
  const turnColor = current?.color ?? "#f2efe6";

  const submitRisk = () => {
    const v = riskValue.trim();
    if (!v) return;
    onGuess(v);
    setRiskValue("");
    setRisking(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 sm:gap-5">
      {/* Palabra + pista + vidas del equipo */}
      <div className="chalk-card px-4 pt-4 pb-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          {writer && (
            <span
              className="chip"
              style={{ borderColor: `${writer.color}66`, color: writer.color }}
              title={writer.level ? `${writer.rankEmoji} Nivel ${writer.level} · ${writer.xp} XP` : undefined}
            >
              <Crown className="w-3.5 h-3.5" /> {writer.name} escribió la palabra
            </span>
          )}
          {hint && (
            <span className="chip" title="Pista">
              Pista: <b className="text-chalk">{hint}</b>
            </span>
          )}
          {headerExtra}
        </div>

        <MaskedWord masked={masked} accent={turnColor} shakeKey={shakeKey} />

        {/* Presupuesto de fallos del equipo (las 10 vidas repartidas) */}
        <div className="mt-4 flex items-center justify-center gap-2" title="Fallos del equipo">
          <Swords className="w-4 h-4 text-chalk-dim" />
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_LIVES }).map((_, i) => (
              <motion.span
                key={i}
                initial={false}
                animate={{ scale: i < teamUsed ? 1 : 0.85, opacity: i < teamUsed ? 1 : 0.3 }}
                className="w-2 sm:w-2.5 h-4 sm:h-5 rounded-[3px]"
                style={{
                  background: i < teamUsed ? "#ff6b6b" : "rgba(242,239,230,0.35)",
                  boxShadow: i < teamUsed ? "0 0 8px rgba(255,107,107,0.55)" : undefined,
                  transform: `rotate(${i % 2 ? 6 : -5}deg)`,
                }}
              />
            ))}
          </div>
          <span className="text-xs font-extrabold text-chalk-dim">
            {teamUsed}/{TOTAL_LIVES}
          </span>
        </div>
      </div>

      {/* Muñecos de los adivinadores */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 px-0.5 justify-start sm:justify-center">
        {guessers.map((p) => {
          const isTurn = p.id === currentTurnId && p.status === "alive";
          const dead = p.status === "hung";
          return (
            <motion.div
              key={p.id}
              layout
              animate={{ scale: isTurn ? 1.04 : 1, opacity: dead ? 0.72 : 1 }}
              className="chalk-card shrink-0 w-[7.6rem] sm:w-36 px-2.5 pt-2.5 pb-2 relative overflow-visible"
              style={{
                borderColor: isTurn ? p.color : dead ? "rgba(242,239,230,0.15)" : "rgba(242,239,230,0.25)",
                boxShadow: isTurn ? `0 0 24px -6px ${p.color}aa` : undefined,
              }}
            >
              {isTurn && (
                <motion.span
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.1 }}
                  className="hand absolute -top-6 left-1/2 -translate-x-1/2 text-xl"
                  style={{ color: p.color }}
                >
                  ▼
                </motion.span>
              )}
              <Hangman
                color={dead ? "#8b8778" : p.color}
                failsUsed={p.failsUsed}
                failsTotal={p.failsTotal}
                mood={dead ? "dead" : "normal"}
                className="w-full h-24 sm:h-28"
                glow={!dead}
              />
              <div className="mt-1.5 text-center">
                <p className="hand text-lg leading-none truncate" style={{ color: dead ? "#8b8778" : p.color }}>
                  {p.name}
                  {p.isMe ? <span className="text-chalk-dim text-sm"> (tú)</span> : null}
                </p>
                {p.level != null && p.level > 0 && (
                  <p className="text-[0.58rem] font-extrabold mt-0.5 opacity-90" style={{ color: p.rankColor ?? "#b9b4a6" }}>
                    {p.rankEmoji} Niv. {p.level} · {p.xp} XP
                  </p>
                )}
                <p className="text-[0.7rem] font-extrabold tracking-wide text-chalk-dim mt-1">
                  {dead ? (
                    <span className="text-coral">AHORCADO</span>
                  ) : (
                    <>
                      <span style={{ color: p.color }}>{p.failsTotal - p.failsUsed}</span> vidas · {p.failsUsed}/{p.failsTotal} fallos
                    </>
                  )}
                </p>
                {p.online === false && <p className="text-[0.62rem] font-bold text-coral/80 mt-0.5">desconectado</p>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Último evento */}
      {lastEvent && (
        <p className="text-center hand text-xl text-chalk-dim -my-1" key={lastEvent} aria-live="polite">
          {lastEvent}
        </p>
      )}

      {/* Controles */}
      {!hideKeyboard && (
        <div>
          {canPlay ? (
            <>
              <AnimatePresence mode="wait">
                {risking ? (
                  <motion.div
                    key="risk"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="chalk-card px-4 py-4 max-w-xl mx-auto"
                  >
                    <p className="text-sm font-bold text-chalk-dim mb-2 text-center">
                      Arriesga la palabra completa · si fallas pierdes <b className="text-coral">2 vidas</b>
                    </p>
                    <div className="flex gap-2">
                      <input
                        className="input-chalk text-center tracking-[0.22em] uppercase"
                        placeholder={`${masked.length} caracteres`}
                        value={riskValue}
                        maxLength={masked.length}
                        autoFocus
                        onChange={(e) => setRiskValue(e.target.value.replace(/[^a-zA-ZñÑáéíóúüÁÉÍÓÚÜ\s]/g, ""))}
                        onKeyDown={(e) => e.key === "Enter" && submitRisk()}
                      />
                      <button type="button" className="btn-chalk btn-fill px-4" onClick={submitRisk} style={{ ["--btn-color" as never]: "#6bcb77" }}>
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    <button type="button" className="mt-3 w-full text-center text-xs font-bold text-chalk-dim hover:text-chalk" onClick={() => setRisking(false)}>
                      Volver al teclado
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="keys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: 10 }}>
                    <Keyboard used={guessed} hits={hits} disabled={!canPlay} onGuess={onGuess} />
                    <button
                      type="button"
                      className="mt-2.5 mx-auto block text-sm font-extrabold text-chalk-dim hover:text-chalk underline decoration-dashed underline-offset-4"
                      onClick={() => setRisking(true)}
                    >
                      Arriesgar la palabra completa (−2 vidas si fallas)
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <p className="text-center text-sm font-bold text-chalk-dim">{waitingLabel}</p>
          )}
          {footnote}
        </div>
      )}
    </div>
  );
}
