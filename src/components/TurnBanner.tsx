"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Smartphone } from "lucide-react";

export interface TurnBannerProps {
  show: boolean;
  name: string;
  color: string;
  onReady: () => void;
}

/** Pantalla intermedia para el modo "mismo dispositivo": pásale el teléfono al siguiente. */
export default function TurnBanner({ show, name, color, onReady }: TurnBannerProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={onReady}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-board/95 backdrop-blur flex flex-col items-center justify-center gap-5 p-6 cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.7, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 16 }}
            className="flex flex-col items-center gap-5"
          >
            <span
              className="grid place-items-center w-24 h-24 rounded-full border-4 animate-floaty"
              style={{ borderColor: color, boxShadow: `0 0 40px ${color}88, inset 0 0 24px ${color}44` }}
            >
              <Smartphone className="w-10 h-10" style={{ color }} />
            </span>
            <p className="hand text-3xl text-chalk-dim">Pásale el teléfono a</p>
            <p className="hand text-7xl font-bold text-glow leading-none" style={{ color }}>
              {name}
            </p>
            <span className="btn-chalk btn-fill px-8 py-3 text-lg hand mt-2" style={{ ["--btn-color" as never]: color }}>
              ¡Aquí estoy, a adivinar!
            </span>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
