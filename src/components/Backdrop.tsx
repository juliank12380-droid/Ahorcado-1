/** Fondo de pizarra + garabatos de tiza decorativos (server component, estático). */
export default function Backdrop() {
  const doodle = "rgba(242,239,230,0.07)";
  return (
    <>
      <div className="board-bg" aria-hidden />
      <svg
        aria-hidden
        className="fixed inset-0 -z-10 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke={doodle} strokeWidth="2" fill="none" strokeLinecap="round">
          {/* estrella */}
          <path d="M60 90 l6 14 14 2 -10 10 2 14 -12 -7 -12 7 2 -14 -10 -10 14 -2 z" transform="rotate(-8 60 105)" />
          {/* espiral */}
          <path d="M90 95 q6 0 6 6 t-6 6 -9 -9 12 -12 16 16" transform="translate(calc(100vw - 220px), 60px)" />
          {/* sol */}
          <g transform="translate(calc(100vw - 150px), calc(100vh - 160px)) rotate(12)">
            <circle cx="0" cy="0" r="16" />
            <path d="M0 -26 v-8 M0 26 v8 M-26 0 h-8 M26 0 h8 M-18 -18 l-6 -6 M18 18 l6 6 M18 -18 l6 -6 M-18 18 l-6 6" />
          </g>
          {/* signos de interrogación */}
          <path d="M0 -6 q0 -8 7 -8 t7 7 q0 6 -7 7 v4" transform="translate(calc(15vw), calc(100vh - 190px)) rotate(14)" />
          <circle cx="7" cy="8" r="1.4" fill={doodle} transform="translate(calc(15vw), calc(100vh - 190px)) rotate(14)" />
          <path d="M0 -6 q0 -8 7 -8 t7 7 q0 6 -7 7 v4" transform="translate(calc(85vw), calc(45vh)) scale(0.7) rotate(-16)" />
          {/* nube */}
          <path d="M0 0 q-14 0 -14 -10 t14 -10 q2 -12 16 -12 t16 12 q12 -2 16 8 t-10 12 z" transform="translate(calc(8vw), calc(42vh)) scale(1.1)" opacity="0.8" />
          {/* corazón */}
          <path d="M0 6 q-12 -8 -12 -16 q0 -8 8 -8 q6 0 8 6 q2 -6 8 -6 q8 0 8 8 q0 8 -12 16 l-4 3 z" transform="translate(calc(78vw), calc(12vh)) scale(0.8) rotate(10)" />
        </g>
      </svg>
    </>
  );
}
