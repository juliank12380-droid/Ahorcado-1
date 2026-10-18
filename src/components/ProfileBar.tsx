"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Ghost,
  KeyRound,
  Loader2,
  LogOut,
  Palette,
  Pencil,
  Settings2,
  Trophy,
  User,
  X,
  Zap,
} from "lucide-react";
import ColorPicker from "@/components/ColorPicker";
import { useToasts } from "@/components/ui";
import {
  attachPassword,
  authErrorMessage,
  changePassword,
  hasPasswordProvider,
  signOutFirebase,
  updateDisplayName,
} from "@/lib/firebase";
import { saveProfile } from "@/lib/session";
import { displayName as clean } from "@/lib/game";
import {
  levelFromXp,
  levelProgress,
  rankForLevel,
  xpForLevel,
  xpInCurrentLevel,
  RANKS,
} from "@/lib/xp";
import { mergeStats } from "@/lib/profile";
import type { IdentityState } from "@/lib/useIdentity";

type Tab = "customize" | "account" | "stats";

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "customize", label: "Apariencia", icon: Palette },
  { id: "account",   label: "Cuenta",     icon: Settings2 },
  { id: "stats",     label: "Estadísticas", icon: BarChart3 },
];

function StatRow({ label, value, color = "#f2efe6" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-chalk/10 last:border-0">
      <span className="text-sm font-bold text-chalk-dim">{label}</span>
      <span className="hand text-2xl font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function XpBar({ totalXp }: { totalXp: number }) {
  const level = levelFromXp(totalXp);
  const rank = rankForLevel(level);
  const inLevel = xpInCurrentLevel(totalXp);
  const needed = xpForLevel(level);
  const pct = levelProgress(totalXp);
  const nextRank = RANKS.find((r) => r.minLevel > level);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{rank.emoji}</span>
          <div>
            <p className="font-extrabold leading-none" style={{ color: rank.color }}>{rank.name}</p>
            <p className="text-xs font-bold text-chalk-dim leading-none">Nivel {level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-chalk-dim">{inLevel} / {needed} XP</p>
          {nextRank && <p className="text-[0.65rem] font-bold text-chalk-dim/70">Siguiente: {nextRank.name} (niv. {nextRank.minLevel})</p>}
        </div>
      </div>
      <div className="h-3 rounded-full bg-chalk/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${rank.color}aa, ${rank.color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <p className="text-[0.68rem] font-bold text-chalk-dim text-right">{totalXp} XP totales</p>
    </div>
  );
}

export default function ProfileBar({ identity }: { identity: IdentityState }) {
  const { user, guest, profile, displayName, color } = identity;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("customize");

  // Cuenta
  const [nameDraft, setNameDraft] = useState(displayName);
  const [pw0, setPw0] = useState("");
  const [pw1, setPw1] = useState("");
  const [busy, setBusy] = useState(false);
  const { push, stack } = useToasts();

  useEffect(() => setNameDraft(displayName), [displayName]);

  const hasPw = hasPasswordProvider(user);
  const initial = (displayName || user?.displayName || "I").slice(0, 1).toUpperCase();
  const stats = mergeStats(profile?.stats);
  const level = levelFromXp(stats.xp);
  const rank = rankForLevel(level);

  const saveName = () => {
    const n = clean(nameDraft);
    if (n.length < 2) return push("El nombre necesita al menos 2 letras");
    identity.setDisplayName(n);
    saveProfile({ name: n });
    if (user) void updateDisplayName(n);
    push("Nombre guardado", "ok");
  };

  const savePassword = async () => {
    if (pw1.length < 6) return push("La contraseña debe tener al menos 6 caracteres");
    setBusy(true);
    try {
      if (hasPw) await changePassword(pw0, pw1);
      else await attachPassword(pw1);
      setPw0(""); setPw1("");
      push(hasPw ? "Contraseña actualizada" : "Contraseña añadida", "ok");
    } catch (e) {
      push(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const winRateGuesser = stats.gamesAsGuesser > 0
    ? Math.round((stats.gamesWonAsGuesser / stats.gamesAsGuesser) * 100)
    : 0;
  const winRateWriter = stats.gamesAsWriter > 0
    ? Math.round((stats.gamesWonAsWriter / stats.gamesAsWriter) * 100)
    : 0;
  const accuracy = (stats.lettersGuessed + stats.lettersMissed) > 0
    ? Math.round((stats.lettersGuessed / (stats.lettersGuessed + stats.lettersMissed)) * 100)
    : 0;

  return (
    <>
      {/* -------- Barra compacta -------- */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="chalk-card w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-chalk/[0.06] transition-colors"
      >
        {user?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border-2 shrink-0" style={{ borderColor: color }} />
        ) : (
          <span className="w-9 h-9 rounded-full grid place-items-center hand text-xl font-bold shrink-0" style={{ background: `${color}22`, border: `2px solid ${color}`, color }}>
            {guest ? <Ghost className="w-4 h-4" /> : initial}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold truncate leading-tight">{displayName || (guest ? "Invitado" : "Jugador")}</span>
          <span className="block text-[0.7rem] font-bold text-chalk-dim leading-tight">
            {guest
              ? "Modo invitado"
              : stats.xp > 0
                ? `${rank.emoji} ${rank.name} · Niv. ${level} · ${stats.xp} XP`
                : (user?.email ?? "Cuenta conectada")}
          </span>
        </span>
        <Pencil className="w-4 h-4 text-chalk-dim shrink-0" />
      </button>

      {/* -------- Modal -------- */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-board/85 backdrop-blur-sm overflow-y-auto"
            onClick={() => setOpen(false)}
          >
            <div className="min-h-full flex items-start sm:items-center justify-center p-4 pt-8">
              <motion.div
                initial={{ scale: 0.93, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="chalk-card w-full max-w-md overflow-hidden"
              >
                {/* Encabezado */}
                <div className="px-6 pt-6 pb-4 flex items-start gap-3 border-b border-chalk/10">
                  {user?.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-full border-2 shrink-0" style={{ borderColor: color }} />
                  ) : (
                    <span className="w-12 h-12 rounded-full grid place-items-center hand text-2xl font-bold shrink-0" style={{ background: `${color}22`, border: `2px solid ${color}`, color }}>
                      {guest ? <Ghost className="w-5 h-5" /> : initial}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-lg leading-tight truncate">{displayName || (guest ? "Invitado" : "Jugador")}</p>
                    {!guest && user?.email && <p className="text-xs font-bold text-chalk-dim truncate">{user.email}</p>}
                    {!guest && stats.xp > 0 && (
                      <p className="text-xs font-bold mt-0.5" style={{ color: rank.color }}>
                        {rank.emoji} {rank.name} · Nivel {level}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="btn-chalk p-1.5 shrink-0" style={{ ["--btn-color" as never]: "#b9b4a6" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Pestañas */}
                {!guest && (
                  <div className="flex border-b border-chalk/10">
                    {TABS.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 text-[0.7rem] font-extrabold transition-colors ${
                          tab === id ? "text-chalk border-b-2 border-chalk -mb-px" : "text-chalk-dim hover:text-chalk"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {/* ======== PESTAÑA: APARIENCIA ======== */}
                  {(tab === "customize" || guest) && (
                    <motion.div
                      key="customize"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="p-6 grid gap-5"
                    >
                      {/* Preview del stickman */}
                      <div className="chalk-dashed rounded-2xl p-4 flex items-center gap-4">
                        <div className="relative">
                          <svg viewBox="0 0 116 136" className="w-20 h-24">
                            <g stroke={color} strokeWidth="3.6" strokeLinecap="round" fill="none"
                              style={{ filter: `drop-shadow(0 0 6px ${color}99)` }}>
                              <circle cx="84" cy="40" r="9.5" />
                              <line x1="84" y1="49.5" x2="84" y2="86" />
                              <line x1="84" y1="57" x2="68" y2="71" />
                              <line x1="84" y1="57" x2="100" y2="71" />
                              <line x1="84" y1="86" x2="70" y2="108" />
                              <line x1="84" y1="86" x2="98" y2="108" />
                            </g>
                            <g stroke="rgba(242,239,230,0.5)" strokeWidth="3.2" strokeLinecap="round" fill="none">
                              <line x1="12" y1="130" x2="104" y2="130" />
                              <line x1="30" y1="130" x2="30" y2="16" />
                              <line x1="30" y1="16" x2="84" y2="16" />
                              <line x1="84" y1="16" x2="84" y2="31" />
                            </g>
                          </svg>
                        </div>
                        <div>
                          <p className="hand text-3xl font-bold leading-none" style={{ color }}>{displayName || "Tu nombre"}</p>
                          <p className="text-xs font-bold text-chalk-dim mt-1.5">Así te ven los demás en la pizarra</p>
                          {!guest && <p className="text-xs font-bold mt-0.5" style={{ color: rank.color }}>{rank.emoji} {rank.name} · Niv. {level}</p>}
                        </div>
                      </div>

                      <ColorPicker
                        value={color}
                        onChange={(c) => {
                          identity.setColor(c);
                          saveProfile({ color: c });
                        }}
                        label="Color de tu tiza (stickman en todas las salas)"
                      />
                      <p className="text-[0.72rem] font-bold text-chalk-dim/80 -mt-2">
                        Si ese color ya lo tomó alguien en una sala, el juego te asigna otro disponible.
                      </p>

                      {guest && (
                        <button
                          type="button"
                          className="btn-chalk py-3 text-lg"
                          style={{ ["--btn-color" as never]: "#FF6B6B" }}
                          onClick={() => { setOpen(false); identity.leaveGuest(); }}
                        >
                          <LogOut className="w-4 h-4" /> Salir del modo invitado
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* ======== PESTAÑA: CUENTA ======== */}
                  {tab === "account" && !guest && (
                    <motion.div
                      key="account"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="p-6 grid gap-5"
                    >
                      {/* Nombre */}
                      <div>
                        <label className="text-sm font-bold text-chalk-dim mb-1.5 flex items-center gap-1.5">
                          <User className="w-4 h-4" /> Nombre de jugador
                        </label>
                        <div className="flex gap-2">
                          <input
                            className="input-chalk"
                            value={nameDraft}
                            maxLength={16}
                            autoComplete="off"
                            onChange={(e) => setNameDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveName()}
                          />
                          <button type="button" className="btn-chalk btn-fill px-4" style={{ ["--btn-color" as never]: "#6BCB77" }} onClick={saveName}>
                            OK
                          </button>
                        </div>
                      </div>

                      {/* Contraseña */}
                      <div>
                        <label className="text-sm font-bold text-chalk-dim mb-1.5 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4" /> {hasPw ? "Cambiar contraseña" : "Añadir contraseña"}
                        </label>
                        <div className="grid gap-2">
                          {hasPw && (
                            <input
                              className="input-chalk"
                              type="password"
                              placeholder="Contraseña actual"
                              autoComplete="current-password"
                              value={pw0}
                              onChange={(e) => setPw0(e.target.value)}
                            />
                          )}
                          <div className="flex gap-2">
                            <input
                              className="input-chalk"
                              type="password"
                              placeholder="Nueva contraseña (mín. 6)"
                              autoComplete="new-password"
                              value={pw1}
                              onChange={(e) => setPw1(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && void savePassword()}
                            />
                            <button type="button" className="btn-chalk btn-fill px-4" style={{ ["--btn-color" as never]: "#4ECDC4" }} disabled={busy} onClick={() => void savePassword()}>
                              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "OK"}
                            </button>
                          </div>
                        </div>
                        {!hasPw && (
                          <p className="text-[0.72rem] font-bold text-chalk-dim/80 mt-1.5">
                            Entraste con Google. Añade una contraseña para entrar también con tu correo.
                          </p>
                        )}
                      </div>

                      {/* Cerrar sesión */}
                      <button
                        type="button"
                        className="btn-chalk py-3 text-lg mt-2"
                        style={{ ["--btn-color" as never]: "#FF6B6B" }}
                        onClick={async () => { setOpen(false); await signOutFirebase(); }}
                      >
                        <LogOut className="w-4 h-4" /> Cerrar sesión
                      </button>
                    </motion.div>
                  )}

                  {/* ======== PESTAÑA: ESTADÍSTICAS ======== */}
                  {tab === "stats" && !guest && (
                    <motion.div
                      key="stats"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="p-6 grid gap-5"
                    >
                      {/* XP y nivel */}
                      <div>
                        <p className="text-sm font-bold text-chalk-dim mb-2 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-sun" /> Progresión
                        </p>
                        <XpBar totalXp={stats.xp} />
                      </div>

                      {/* General */}
                      <div>
                        <p className="text-sm font-bold text-chalk-dim mb-1 flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-sun" /> General
                        </p>
                        <StatRow label="Partidas jugadas" value={stats.gamesPlayed} />
                        <StatRow label="Victorias totales" value={stats.gamesWon} color="#6BCB77" />
                        <StatRow label="Derrotas totales" value={stats.gamesLost} color="#FF6B6B" />
                      </div>

                      {/* Como adivinador */}
                      <div>
                        <p className="text-sm font-bold text-chalk-dim mb-1 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-cyan-chalk" /> Como adivinador
                        </p>
                        <StatRow label="Rondas como adivinador" value={stats.gamesAsGuesser} />
                        <StatRow label="Rondas ganadas" value={stats.gamesWonAsGuesser} color="#6BCB77" />
                        <StatRow label="% victorias" value={`${winRateGuesser}%`} color="#4ECDC4" />
                        <StatRow label="Letras acertadas" value={stats.lettersGuessed} color="#6BCB77" />
                        <StatRow label="Letras falladas" value={stats.lettersMissed} color="#FF6B6B" />
                        <StatRow label="% precisión" value={`${accuracy}%`} color="#FFD93D" />
                      </div>

                      {/* Como escritor */}
                      <div>
                        <p className="text-sm font-bold text-chalk-dim mb-1 flex items-center gap-1.5">
                          <Pencil className="w-4 h-4 text-sun" /> Como escritor
                        </p>
                        <StatRow label="Rondas como escritor" value={stats.gamesAsWriter} />
                        <StatRow label="Palabras que no adivinaron" value={stats.gamesWonAsWriter} color="#6BCB77" />
                        <StatRow label="% victorias como escritor" value={`${winRateWriter}%`} color="#FFD93D" />
                        <StatRow label="Total de palabras escritas" value={stats.wordsWritten} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {stack}
    </>
  );
}
