"use client";

import { motion } from "framer-motion";

const ROWS = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];

export interface KeyboardProps {
  used: string; // letras ya intentadas
  hits: string; // letras acertadas (aparecen en la palabra)
  disabled?: boolean;
  onGuess: (letter: string) => void;
}

export default function Keyboard({ used, hits, disabled, onGuess }: KeyboardProps) {
  return (
    <div className="w-full max-w-xl mx-auto select-none" aria-label="Teclado">
      {ROWS.map((row, r) => (
        <div key={row} className="flex justify-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2" style={{ paddingLeft: r === 2 ? "6%" : 0, paddingRight: r === 2 ? "6%" : 0 }}>
          {row.split("").map((letter) => {
            const usedUp = used.includes(letter);
            const isHit = hits.includes(letter);
            const isMiss = usedUp && !isHit;
            return (
              <motion.button
                key={letter}
                type="button"
                whileTap={{ scale: 0.88, rotate: -2 }}
                disabled={disabled || usedUp}
                onClick={() => onGuess(letter)}
                aria-label={`Letra ${letter}`}
                className={[
                  "flex-1 h-11 sm:h-13 rounded-lg sm:rounded-xl border-2 font-black text-base sm:text-lg transition-all duration-200 hand",
                  isHit
                    ? "border-mint/70 text-mint bg-mint/10 shadow-[0_0_16px_-4px_rgba(107,203,119,0.6)]"
                    : isMiss
                      ? "border-coral/40 text-coral/50 line-through decoration-2 bg-black/20"
                      : "border-chalk/35 text-chalk bg-chalk/[0.04] hover:bg-chalk/15 hover:-translate-y-0.5 active:translate-y-0",
                  usedUp ? "opacity-80" : "",
                  disabled && !usedUp ? "opacity-40 pointer-events-none" : "",
                ].join(" ")}
              >
                {letter}
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
