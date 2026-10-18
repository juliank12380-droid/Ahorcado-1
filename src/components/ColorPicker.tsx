"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PLAYER_COLORS } from "@/lib/game";

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  taken?: string[];
  label?: string;
}

/** Paleta de tizas de colores para personalizar el stickman. */
export default function ColorPicker({ value, onChange, taken = [], label = "Elige el color de tu muñeco" }: ColorPickerProps) {
  return (
    <div>
      <p className="text-sm font-bold text-chalk-dim mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-2.5">
        {PLAYER_COLORS.map((c) => {
          const isTaken = taken.includes(c.value) && c.value !== value;
          const selected = value === c.value;
          return (
            <motion.button
              key={c.id}
              type="button"
              whileTap={{ scale: 0.85 }}
              disabled={isTaken}
              onClick={() => onChange(c.value)}
              title={isTaken ? `${c.name} (ocupado)` : c.name}
              aria-label={`Color ${c.name}${isTaken ? ", ocupado" : ""}`}
              className={[
                "relative w-10 h-10 rounded-full border-2 transition-all duration-150",
                selected ? "scale-110 border-chalk" : "border-white/15 hover:scale-105",
                isTaken ? "opacity-20 saturate-0 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              style={{
                background: `linear-gradient(145deg, ${c.value}, ${c.value}cc 60%, ${c.value}88)`,
                boxShadow: selected ? `0 0 0 3px rgba(0,0,0,0.4), 0 0 18px ${c.value}99` : "inset -3px -4px 6px rgba(0,0,0,0.35), inset 2px 3px 4px rgba(255,255,255,0.25)",
              }}
            >
              {selected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 grid place-items-center"
                >
                  <Check className="w-5 h-5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] text-board" strokeWidth={3.5} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
