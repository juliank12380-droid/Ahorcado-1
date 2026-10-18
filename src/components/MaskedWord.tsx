"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface MaskedWordProps {
  /** 
   * Puede ser un array (de la API) o un string (de RTDB).
   * Array: [ "C", null, "/", "A" ]  (null = oculto)
   * String: "C_/_A"                 (_ = oculto)
   */
  masked: (string | null)[] | string;
  accent?: string;
  shakeKey?: number;
  compact?: boolean;
}

/** La palabra oculta, letra a letra, estilo tiza sobre pizarra. */
export default function MaskedWord({
  masked,
  accent = "#f2efe6",
  shakeKey = 0,
  compact = false,
}: MaskedWordProps) {
  // Convertimos a array de trabajo uniforme
  const items = Array.isArray(masked) ? masked : masked.split("");

  return (
    <motion.div
      key={shakeKey}
      className="flex flex-wrap justify-center gap-x-2 gap-y-4 px-2 py-2"
      animate={shakeKey ? { x: [0, -10, 8, -6, 4, 0] } : undefined}
      transition={{ duration: 0.4 }}
    >
      {items.map((rawLetter, i) => {
        // Normalizamos el caracter: null o "_" significan oculto
        const isHidden = rawLetter === null || rawLetter === "_";
        const isSpace = rawLetter === "/";
        const letter = isHidden ? null : rawLetter;

        if (isSpace) {
          return (
            <div
              key={`space-${i}`}
              className="flex items-center justify-center select-none"
              style={{
                width: compact ? "1.4rem" : "clamp(1.8rem, 6vw, 2.8rem)",
                height: compact ? "2rem" : "clamp(2.4rem, 8vw, 3.6rem)",
              }}
            >
              <span
                className="hand font-black opacity-50"
                style={{
                  fontSize: compact ? "1.8rem" : "clamp(2.2rem, 9vw, 3.6rem)",
                  color: "#FFD93D", // Amarillo brillante para el espacio
                  textShadow: "0 0 12px rgba(255, 217, 61, 0.4)",
                  transform: "rotate(10deg)",
                }}
              >
                /
              </span>
            </div>
          );
        }

        return (
          <div
            key={`letter-${i}`}
            className="relative flex items-end justify-center"
            style={{
              width: compact ? "1.35rem" : "clamp(1.6rem, 5.4vw, 2.6rem)",
              height: compact ? "2rem" : "clamp(2.4rem, 8vw, 3.6rem)",
            }}
          >
            {/* Guion de la tiza */}
            <span
              className="absolute bottom-0 left-0 right-0 h-[3.5px] rounded-full"
              style={{
                background: accent,
                opacity: 0.6,
                boxShadow: `0 0 10px ${accent}88`,
              }}
            />
            
            <AnimatePresence mode="popLayout">
              {letter && (
                <motion.span
                  key={`${i}-${letter}`}
                  initial={{ opacity: 0, y: -20, scale: 1.8, rotate: -15 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: -2 }}
                  transition={{ type: "spring", stiffness: 450, damping: 20 }}
                  className="hand font-bold text-glow pb-1"
                  style={{
                    fontSize: compact ? "1.6rem" : "clamp(2rem, 8vw, 3.2rem)",
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
