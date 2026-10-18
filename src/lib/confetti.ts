"use client";

export async function burstConfetti(colors: string[]) {
  if (typeof window === "undefined") return;
  const confetti = (await import("canvas-confetti")).default;
  const opts = { colors, disableForReducedMotion: true, zIndex: 999 };
  confetti({
    ...opts,
    particleCount: 90,
    spread: 75,
    startVelocity: 42,
    origin: { y: 0.7 },
  });
  window.setTimeout(() => {
    confetti({ ...opts, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.8 } });
    confetti({ ...opts, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.8 } });
  }, 260);
}
