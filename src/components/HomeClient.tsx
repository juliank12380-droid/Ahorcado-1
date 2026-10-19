"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Cloud,
  Globe2,
  KeyRound,
  Loader2,
  Lock,
  type LucideIcon,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Users,
  Wifi,
} from "lucide-react";
import AuthGate from "@/components/AuthGate";
import ProfileBar from "@/components/ProfileBar";
import Hangman from "@/components/Hangman";
import { Spinner, useToasts } from "@/components/ui";
import { useIdentity } from "@/lib/useIdentity";
import { saveProfile, saveSession } from "@/lib/session";
import { displayName as clean } from "@/lib/game";
import type { JoinResponse, PublicRoomDTO, RoomNetwork } from "@/lib/dto";

type View = "menu" | "auth" | "hub" | "create" | "code" | "browse";

const anim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.22, ease: "easeOut" as const },
};

function BigButton({
  icon: Icon,
  title,
  subtitle,
  color,
  onClick,
  locked = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
  locked?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="chalk-card w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-chalk/[0.06] transition-colors"
      style={{ borderColor: `${color}66` }}
    >
      <span className="grid place-items-center w-12 h-12 rounded-2xl shrink-0" style={{ background: `${color}1f`, border: `2px solid ${color}80` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="hand block text-3xl font-bold leading-none" style={{ color }}>
          {title}
        </span>
        <span className="block text-[0.78rem] font-bold text-chalk-dim mt-1">{subtitle}</span>
      </span>
      {locked && <Lock className="w-4 h-4 text-chalk-dim shrink-0" />}
    </motion.button>
  );
}

export default function HomeClient() {
  const router = useRouter();
  const identity = useIdentity();
  const { push, stack } = useToasts();

  const [view, setView] = useState<View>("menu");
  const [network, setNetwork] = useState<RoomNetwork>("lan");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [maxPlayers, setMaxPlayers] = useState(11);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<PublicRoomDTO[] | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const enterRoom = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      if (busy) return;
      setBusy(true);
      try {
        const auth = await identity.authBody();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, ...auth, name: identity.displayName, color: identity.color }),
        });
        const data = (await res.json()) as JoinResponse | { ok: false; error: string };
        if (!res.ok || !data.ok) {
          push("error" in data ? data.error : "Algo salió mal");
          return;
        }
        saveSession(data.code, { playerId: data.playerId, token: data.token, name: data.name });
        router.push(`/room/${data.code}`);
      } catch {
        push("Sin conexión. Revisa tu red.");
      } finally {
        setBusy(false);
      }
    },
    [busy, identity, push, router],
  );

  const loadList = useCallback(async () => {
    setList(null);
    try {
      const res = await fetch(`/api/rooms/public?network=${network}`, { cache: "no-store" });
      const data = await res.json();
      setList(data.ok ? (data.rooms as PublicRoomDTO[]) : []);
    } catch {
      setList([]);
    }
  }, [network]);

  useEffect(() => {
    if (view === "browse") void loadList();
  }, [view, loadList]);

  if (identity.loading) return <Spinner label="Cargando…" />;

  // Inicio de sesión: obligatorio para el modo en línea.
  // Los invitados solo pueden jugar en el mismo teléfono o en LAN, así que el
  // botón "sin cuenta" no activa ningún modo libre: solo lleva al hub LAN.
  if (view === "auth") {
    if (identity.user) {
      setView("hub");
      return <Spinner label="Entrando…" />;
    }
    return (
      <AuthGate
        onGuest={() => {
          identity.continueAsGuest();
          setNetwork("lan");
          setView("hub");
        }}
        guestLabel="Jugar en red local o mismo teléfono"
        notice="Sin cuenta solo puedes jugar en el mismo teléfono o en tu red Wi-Fi. Para jugar a distancia inicia sesión."
      />
    );
  }

  // Escudo: nadie llega a las vistas en línea sin cuenta (ni por bug de estado).
  const onlineViews: View[] = ["hub", "create", "code", "browse"];
  if (network === "online" && !identity.user && onlineViews.includes(view)) {
    setView("auth");
    return <Spinner label="Solicitando cuenta…" />;
  }

  const needsName = clean(identity.displayName).length < 2;
  const accent = network === "lan" ? "#6BCB77" : "#4ECDC4";

  /**
   * Si nunca se puso nombre (primera vez), le pedimos UNA vez. Después de eso
   * el nombre se cambia exclusivamente desde el perfil (arriba). No se permite
   * escribir un nombre distinto al crear/unir sala: siempre usa el del perfil.
   */
  const saveName = () => {
    const n = clean(nameDraft);
    if (n.length < 2) return push("Escribe un nombre de al menos 2 letras");
    identity.setDisplayName(n);
    saveProfile({ name: n });
    if (!identity.user) identity.continueAsGuest();
  };

  /** Solo aparece si NUNCA se puso un nombre (primera vez). */
  const NameField = needsName ? (
    <div className="chalk-dashed px-4 py-3 grid gap-2">
      <label className="text-sm font-bold text-chalk-dim">Primero elige tu nombre de jugador</label>
      <div className="flex gap-2">
        <input
          className="input-chalk"
          placeholder="Tu nombre"
          value={nameDraft}
          maxLength={16}
          autoFocus
          autoComplete="off"
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
        />
        <button type="button" className="btn-chalk btn-fill px-4" style={{ ["--btn-color" as never]: accent }} onClick={saveName}>
          OK
        </button>
      </div>
      <p className="text-[0.7rem] font-bold text-chalk-dim/80">
        Después lo cambias desde tu perfil (arriba).
      </p>
    </div>
  ) : null;

  return (
    <main className="relative mx-auto max-w-md px-4 pt-6 pb-14">
      {(identity.user || identity.guest) && <ProfileBar identity={identity} />}

      <div className="text-center mt-6 mb-5">
        <div className="flex justify-center">
          <Hangman color={identity.color} failsUsed={6} failsTotal={10} className="w-20 h-24 animate-floaty" />
        </div>
        <h1 className="hand text-[clamp(2.8rem,12vw,4.2rem)] font-bold leading-[0.85] text-glow">El Ahorcado</h1>
      </div>

      <AnimatePresence mode="wait">
        {/* ------------------------------- MENÚ (3) ------------------------------- */}
        {view === "menu" && (
          <motion.div key="menu" {...anim} className="grid gap-3">
            <BigButton
              icon={Smartphone}
              title="Un solo teléfono"
              subtitle="Pasa y juega, sin internet"
              color="#FFD93D"
              onClick={() => router.push("/local")}
            />
            <BigButton
              icon={Wifi}
              title="Red local (LAN)"
              subtitle="Mismo Wi-Fi · sin cuenta, entra y juega"
              color="#6BCB77"
              onClick={() => {
                setNetwork("lan");
                setView("hub");
              }}
            />
            <BigButton
              icon={Globe2}
              title="En línea"
              subtitle={identity.user ? "A distancia, con tus amigos" : "A distancia · requiere cuenta"}
              color="#4ECDC4"
              locked={!identity.user}
              onClick={() => {
                setNetwork("online");
                setView(identity.user ? "hub" : "auth");
              }}
            />
          </motion.div>
        )}

        {/* --------------------------- HUB (crear/código/buscar) --------------------------- */}
        {view === "hub" && (
          <motion.div key="hub" {...anim} className="grid gap-3">
            <p className="chip mx-auto">
              {network === "lan" ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-mint" /> Red local
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-cyan-chalk" /> En línea
                </>
              )}
            </p>
            <BigButton icon={Plus} title="Crear sala" subtitle="Pública o privada" color={accent} onClick={() => setView("create")} />
            <BigButton icon={KeyRound} title="Código" subtitle="Entra con el código de un amigo" color="#FFD93D" onClick={() => setView("code")} />
            <BigButton icon={Search} title="Buscar partida" subtitle="Salas públicas abiertas ahora" color="#B084CC" onClick={() => setView("browse")} />
            {network === "lan" && !identity.user && (
              <div className="chalk-dashed px-4 py-3 text-[0.78rem] font-bold text-chalk-dim text-left">
                Juegas sin cuenta: estas salas son de <b className="text-chalk">tu red Wi-Fi</b>. Para jugar a distancia
                inicia sesión desde En línea.
              </div>
            )}
            <button type="button" className="btn-chalk py-3 mt-1" style={{ ["--btn-color" as never]: "#b9b4a6" }} onClick={() => setView("menu")}>
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          </motion.div>
        )}

        {/* -------------------------------- CREAR -------------------------------- */}
        {view === "create" && (
          <motion.div key="create" {...anim} className="chalk-card p-5 grid gap-4">
            <h2 className="hand text-4xl font-bold leading-none">Crear sala</h2>
            {NameField}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/25 border-2 border-chalk/10">
              {(
                [
                  ["public", "Pública", Globe2],
                  ["private", "Privada", Lock],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`hand flex items-center justify-center gap-2 rounded-xl py-2.5 text-xl font-bold transition-all ${
                    visibility === v ? "bg-chalk/15 text-chalk" : "text-chalk-dim hover:text-chalk"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
            <p className="text-[0.78rem] font-bold text-chalk-dim">
              {visibility === "public"
                ? "Cualquiera puede encontrarla en Buscar partida (también tendrá código)."
                : "Solo entran quienes tengan el código."}
            </p>

            {/* Máx. jugadores */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-chalk-dim flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Máx. jugadores
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-chalk px-2.5 py-1 text-lg hand"
                  style={{ ["--btn-color" as never]: "#b9b4a6" }}
                  disabled={maxPlayers <= 2}
                  onClick={() => setMaxPlayers((m) => Math.max(2, m - 1))}
                >
                  −
                </button>
                <span className="hand text-2xl font-bold w-8 text-center">{maxPlayers}</span>
                <button
                  type="button"
                  className="btn-chalk px-2.5 py-1 text-lg hand"
                  style={{ ["--btn-color" as never]: "#b9b4a6" }}
                  disabled={maxPlayers >= 11}
                  onClick={() => setMaxPlayers((m) => Math.min(11, m + 1))}
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn-chalk btn-fill py-3.5 text-2xl hand"
              style={{ ["--btn-color" as never]: accent }}
              disabled={busy || needsName}
              onClick={() => void enterRoom("/api/rooms", { visibility, network, maxPlayers })}
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Crear
            </button>
            <button type="button" className="text-sm font-bold text-chalk-dim hover:text-chalk" onClick={() => setView("hub")}>
              Volver
            </button>
          </motion.div>
        )}

        {/* -------------------------------- CÓDIGO -------------------------------- */}
        {view === "code" && (
          <motion.div key="code" {...anim} className="chalk-card p-5 grid gap-4">
            <h2 className="hand text-4xl font-bold leading-none">Código de sala</h2>
            {NameField}
            <input
              className="input-chalk hand text-4xl tracking-[0.4em] uppercase text-center text-sun"
              placeholder="ABCDE"
              value={code}
              maxLength={6}
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && code.length >= 4 && !needsName && void enterRoom("/api/rooms/join", { code })}
            />
            <button
              type="button"
              className="btn-chalk btn-fill py-3.5 text-2xl hand"
              style={{ ["--btn-color" as never]: "#FFD93D" }}
              disabled={busy || code.length < 4 || needsName}
              onClick={() => void enterRoom("/api/rooms/join", { code })}
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />} Entrar
            </button>
            <button type="button" className="text-sm font-bold text-chalk-dim hover:text-chalk" onClick={() => setView("hub")}>
              Volver
            </button>
          </motion.div>
        )}

        {/* -------------------------------- BUSCAR -------------------------------- */}
        {view === "browse" && (
          <motion.div key="browse" {...anim} className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="hand text-4xl font-bold leading-none">Partidas</h2>
              <button type="button" className="btn-chalk p-2.5" style={{ ["--btn-color" as never]: "#b9b4a6" }} onClick={() => void loadList()}>
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {NameField}

            {list === null ? (
              <Spinner label="Buscando salas…" />
            ) : list.length === 0 ? (
              <div className="chalk-dashed px-4 py-8 text-center">
                <p className="hand text-3xl text-chalk-dim">No hay salas públicas</p>
                <button
                  type="button"
                  className="btn-chalk btn-fill mt-4 px-5 py-2.5 text-lg hand"
                  style={{ ["--btn-color" as never]: accent }}
                  onClick={() => setView("create")}
                >
                  <Plus className="w-4 h-4" /> Crear la primera
                </button>
              </div>
            ) : (
              list.map((r) => {
                const full = r.playerCount >= r.maxPlayers;
                const playing = r.status !== "lobby";
                return (
                  <motion.button
                    key={r.code}
                    type="button"
                    layout
                    whileTap={{ scale: 0.98 }}
                    disabled={busy || full || needsName}
                    onClick={() => void enterRoom("/api/rooms/join", { code: r.code })}
                    className="chalk-card flex items-center gap-3 px-4 py-3 text-left disabled:opacity-45 hover:bg-chalk/[0.06] transition-colors"
                  >
                    <span className="hand text-3xl font-bold text-sun tracking-[0.15em] shrink-0">{r.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold truncate">Sala de {r.hostName}</span>
                      <span className="flex items-center gap-1.5 mt-1">
                        {r.colors.slice(0, 6).map((c, i) => (
                          <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                        ))}
                        <span className="text-[0.7rem] font-bold text-chalk-dim ml-1">
                          {r.playerCount}/{r.maxPlayers}
                          {playing ? " · en partida" : " · esperando"}
                        </span>
                      </span>
                    </span>
                    <span className="chip shrink-0 text-[0.65rem]">
                      {r.network === "lan" ? <Wifi className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                      {full ? "Llena" : "Entrar"}
                    </span>
                  </motion.button>
                );
              })
            )}

            <button type="button" className="btn-chalk py-3 mt-1" style={{ ["--btn-color" as never]: "#b9b4a6" }} onClick={() => setView("hub")}>
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-8 text-center text-[0.7rem] font-bold text-chalk-dim/70 flex items-center justify-center gap-1.5">
        <Users className="w-3.5 h-3.5" /> 2–11 jugadores · 10 vidas repartidas
      </p>
      {stack}
    </main>
  );
}
