"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-chalk-dim">
      <motion.span
        className="block w-9 h-9 rounded-full border-[3px] border-chalk/20 border-t-chalk"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
      />
      <span className="hand text-xl">{label}</span>
    </div>
  );
}

interface Toast {
  id: number;
  text: string;
  kind: "error" | "ok";
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((text: string, kind: Toast["kind"] = "error") => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const stack = (
    <div className="fixed bottom-5 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 font-bold text-sm backdrop-blur-md shadow-xl ${
              t.kind === "error"
                ? "border-coral/60 bg-[#1c0f10]/90 text-coral"
                : "border-mint/60 bg-[#0c1a10]/90 text-mint"
            }`}
          >
            {t.kind === "error" ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return { push, stack };
}
