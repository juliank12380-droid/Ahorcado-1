"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Skull, Trophy } from "lucide-react";
import Hangman from "@/components/Hangman";
import type { FieldPlayer } from "@/components/GameField";

export interface ResultOverlayProps {
  winner: "guessers" | "writer";
  word: string;
  writerName: string;
  players: FieldPlayer[];
  children?: ReactNode;
}

export default function ResultOverlay({ winner, word, writerName, players, children }: ResultOverlayProps) {
  const guessers = players.filter((p) => p.role === "guesser");
  const guessersWon = winner === "guessers";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 bg-board/85 backdrop-blur-sm overflow-y-auto"
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.82, rotate: -2, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="chalk-card w-full max-w-lg px-6 py-8 text-center"
        >
          <div className="flex justify-center mb-2">
            {guessersWon ? (
              <Trophy className="w-10 h-10 text-sun drop-shadow-[0_0_14px_rgba(255,217,61,0.7)]" />
            ) : (
              <Skull className="w-10 h-10 text-coral drop-shadow-[0_0_14px_rgba(255,107,107,0.7)]" />
            )}
          </div>
          <h2
            className={`hand text-5xl sm:text-6xl font-bold leading-none text-glow ${guessersWon ? "text-mint" : "text-coral"}`}
          >
            {guessersWon ? "¡Ganan los" : "¡Todos"}
            <br />
            {guessersWon ? "adivinadores!" : "ahorcados!"}
          </h2>
          <p className="mt-3 text-chalk-dim font-bold">
            {guessersWon ? "Descifraron la palabra a tiempo." : `${writerName} se lleva la ronda con su palabra.`}
          </p>

          <div className="mt-5 chalk-dashed px-4 py-3">
            <p className="text-xs font-extrabold tracking-[0.25em] text-chalk-dim">LA PALABRA ERA</p>
            <p className="hand text-5xl font-bold text-sun text-glow mt-1 tracking-wide">{word}</p>
          </div>

          <div className="mt-5 flex justify-center gap-4 flex-wrap">
            {guessers.map((p) => (
              <div key={p.id} className="w-20">
                <Hangman
                  color={p.color}
                  failsUsed={p.failsUsed}
                  failsTotal={p.failsTotal}
                  mood={p.status === "hung" ? "dead" : guessersWon ? "happy" : "normal"}
                  className="w-full h-20"
                />
                <p className="hand text-lg leading-tight truncate" style={{ color: p.color }}>
                  {p.name}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">{children}</div>
        </motion.div>
      </div>
    </motion.div>
  );
}
