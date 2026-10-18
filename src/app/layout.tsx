import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Backdrop from "@/components/Backdrop";
import "./globals.css";

export const metadata: Metadata = {
  title: "El Ahorcado · Tiza & Rondas",
  description:
    "Juego del ahorcado multijugador: mismo dispositivo, red local (LAN) o en línea con código de sala, salas públicas y stickmans de colores.",
};

export const viewport: Viewport = {
  themeColor: "#0b0f0d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Fuentes auto-alojadas: sin dependencias externas en tiempo de build */}
        <link rel="preload" href="/fonts/caveat.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/nunito.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body className="bg-board text-chalk font-body antialiased min-h-dvh selection:bg-chalk/20">
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
