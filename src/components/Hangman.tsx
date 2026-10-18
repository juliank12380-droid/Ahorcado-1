"use client";

import { useId } from "react";
import { motion } from "framer-motion";

const NEUTRAL = "#e8e4d8";

interface Part {
  d?: string;
  circle?: { cx: number; cy: number; r: number };
}

/** 4 partes de la horca + 6 del muñeco = las 10 vidas clásicas */
const GALLOWS: Part[] = [
  { d: "M12 130 L104 130" }, // base
  { d: "M30 130 L30 16" }, // poste
  { d: "M30 16 L84 16" }, // viga
  { d: "M84 16 L84 31" }, // soga
];
const BODY: Part[] = [
  { circle: { cx: 84, cy: 40, r: 9.5 } }, // cabeza
  { d: "M84 49.5 L84 86" }, // torso
  { d: "M84 57 L68 71" }, // brazo izq
  { d: "M84 57 L100 71" }, // brazo der
  { d: "M84 86 L70 108" }, // pierna izq
  { d: "M84 86 L98 108" }, // pierna der
];
const ALL = [...GALLOWS, ...BODY];
const TOTAL_PARTS = ALL.length;

export interface HangmanProps {
  color: string;
  failsUsed: number;
  failsTotal: number;
  mood?: "normal" | "happy" | "dead";
  className?: string;
  glow?: boolean;
}

export function visibleParts(failsUsed: number, failsTotal: number): number {
  if (failsTotal <= 0) return failsUsed > 0 ? TOTAL_PARTS : 0;
  return Math.min(TOTAL_PARTS, Math.floor((failsUsed / failsTotal) * TOTAL_PARTS + 1e-6));
}

/** Muñeco de tiza dibujado progresivamente según los fallos del jugador. */
export default function Hangman({
  color,
  failsUsed,
  failsTotal,
  mood = "normal",
  className = "",
  glow = true,
}: HangmanProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const filterId = `chalk-${rawId}`;
  const dead = mood === "dead";
  const visible = visibleParts(failsUsed, failsTotal);
  const headVisible = visible >= 5;

  return (
    <svg viewBox="0 0 116 136" className={className} role="img" aria-label={`Figura del ahorcado: ${failsUsed} de ${failsTotal} fallos`}>
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" result="n" seed={rawId.length} />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </defs>

      <g filter={`url(#${filterId})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {ALL.slice(0, visible).map((p, i) => {
          const isBody = i >= GALLOWS.length;
          const stroke = isBody ? color : NEUTRAL;
          const opacity = isBody ? 0.98 : 0.55;
          const common = {
            stroke,
            opacity,
            strokeWidth: isBody ? 3.6 : 3.2,
            initial: { pathLength: 0, opacity: 0 },
            animate: { pathLength: 1, opacity },
            transition: { duration: 0.5, delay: i * 0.07, ease: "easeOut" as const },
            style: glow && isBody ? { filter: `drop-shadow(0 0 4px ${color}aa)` } : undefined,
          };
          return p.circle ? (
            <motion.circle key={i} cx={p.circle.cx} cy={p.circle.cy} r={p.circle.r} {...common} />
          ) : (
            <motion.path key={i} d={p.d} {...common} />
          );
        })}

        {/* Carita */}
        {headVisible && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          >
            {dead ? (
              <>
                <path d="M78.5 36.5 L82 40 M82 36.5 L78.5 40" />
                <path d="M86.5 36.5 L90 40 M90 36.5 L86.5 40" />
                <path d="M79 45.5 Q84 43 89 45.5" />
              </>
            ) : mood === "happy" ? (
              <>
                <path d="M78.5 38.5 Q80.2 36.5 82 38.5" />
                <path d="M86.5 38.5 Q88.2 36.5 90 38.5" />
                <path d="M79.5 42.5 Q84 47 88.5 42.5" />
              </>
            ) : (
              <>
                <circle cx="80.3" cy="38" r="0.4" fill={color} />
                <circle cx="87.7" cy="38" r="0.4" fill={color} />
                <path d="M80 43 Q84 45.5 88 43" />
              </>
            )}
          </motion.g>
        )}
      </g>
    </svg>
  );
}
