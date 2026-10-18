"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface MaskedWordProps {
  masked: (string | null)[];
  accent?: string;
  shakeKey?: number;
  compact?: boolean;
}

/** La palabra oculta, letra a letra, estilo tiza sobre pizarra. */
export default function MaskedWord({ masked, accent = "#f2efe6", shakeKey = 0, compact = false }: MaskedWordProps) {
  return (
    <motion.div
      key={shakeKey}
      className="flex flex-wrap justify-center gap-x-1.5 gap-y-3 px-2"
      animate={shakeKey ? { x: [0, -8, 7, -5, 3, 0] } : undefined}
      transition={{ duration: 0.4 }}
    >
      {masked.map((letter, i) => {
        const isSpace = letter === "/";

        /* ─── Separador de espacio: un "/" grande, sin guion abajo ─── */
        if (isSpace) {
          return (
            <div
              key={i}
              className="flex items-end justify-center"
              style={{
                width: compact ? "1rem" : "clamp(1.2rem, 4vw, 2rem)",
                height: compact ? "2rem" : "clamp(2.4rem, 8vw, 3.6rem)",
              }}
            >
              <span
                className="hand font-bold opacity-30 select-none"
                style={{
                  fontSize: compact ? "1.6rem" : "clamp(2rem, 7vw, 3.2rem)",
                  color: accent,
                  lineHeight: 1,
                }}
              >
                /
              </span>
            </div>
          );
        }

        /* ─── Letra normal (revelada o guion de oculta) ─── */
        return (
          <div
            key={i}
            className="relative flex items-end justify-center"
            style={{
              width: compact ? "1.35rem" : "clamp(1.6rem, 5.4vw, 2.6rem)",
              height: compact ? "2rem" : "clamp(2.4rem, 8vw, 3.6rem)",
            }}
          >
            {/* Guion bajo */}
            <span
              className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full"
              style={{ background: accent, opacity: 0.55, boxShadow: `0 0 8px ${accent}66` }}
            />
            <AnimatePresence mode="popLayout">
              {letter && (
                <motion.span
                  key={`${i}-${letter}`}
                  initial={{ opacity: 0, y: -18, scale: 1.6, rotate: -12 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: -2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="hand font-bold text-glow pb-0.5"
                  style={{
                    fontSize: compact ? "1.5rem" : "clamp(1.9rem, 7.4vw, 3rem)",
                    color: accent,
                    lineHeight: 1,
                  }}
                >
                  {letter}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </motion.div>
  );
}
