"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, X } from "lucide-react";
interface ScorePlayer {
  id: string;
  name: string;
  color: string;
  sessionPoints: number;
}

interface Props {
  players: ScorePlayer[];
  myId: string | null;
}

/**
 * Marcador de puntos de sesión.
 * Flota en la esquina superior derecha de la sala.
 * Toca el trofeo para expandir/colapsar.
 */
export default function SessionScoreboard({ players, myId }: Props) {
  const [open, setOpen] = useState(false);

  // Ordenar de más a menos puntos
  const sorted = [...players].sort((a, b) => b.sessionPoints - a.sessionPoints);
  const top = sorted[0];
  const myPoints = players.find((p) => p.id === myId)?.sessionPoints ?? 0;

  return (
    <div className="fixed top-4 right-4 z-30 flex flex-col items-end gap-1.5">
      {/* Botón flotante */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        className="flex items-center gap-1.5 chalk-card px-3 py-2 shadow-xl"
        style={{
          borderColor: open ? "#FFD93D66" : "rgba(242,239,230,0.25)",
          boxShadow: open ? "0 0 18px -4px rgba(255,217,61,0.5)" : undefined,
        }}
      >
        <Trophy className="w-4 h-4 text-sun shrink-0" />
        <span className="hand text-xl font-bold text-sun">{myPoints}</span>
        {!open && top && top.id !== myId && (
          <span className="text-[0.65rem] font-extrabold text-chalk-dim ml-0.5">
            · líder {top.sessionPoints}
          </span>
        )}
      </motion.button>

      {/* Tabla expandida */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.18 }}
            className="chalk-card px-4 py-3 min-w-[180px] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <p className="text-xs font-extrabold text-chalk-dim flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-sun" /> PUNTOS DE SESIÓN
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-chalk-dim hover:text-chalk"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <ul className="grid gap-1.5">
              {sorted.map((p, i) => {
                const isMe = p.id === myId;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                return (
                  <motion.li
                    key={p.id}
                    layout
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm w-5 text-center shrink-0">{medal}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
                    />
                    <span
                      className="text-sm font-extrabold flex-1 truncate"
                      style={{ color: isMe ? p.color : "#f2efe6" }}
                    >
                      {p.name}
                      {isMe && <span className="text-chalk-dim font-bold"> (tú)</span>}
                    </span>
                    <span
                      className="hand text-xl font-bold shrink-0"
                      style={{ color: i === 0 ? "#FFD93D" : "#f2efe6" }}
                    >
                      {p.sessionPoints}
                    </span>
                  </motion.li>
                );
              })}
            </ul>

            <p className="text-[0.62rem] font-bold text-chalk-dim/70 mt-3 border-t border-chalk/10 pt-2 leading-relaxed">
              Vidas sobrantes = más pts · Se acumulan hasta cerrar la sala.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
