"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Ghost,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { GoogleIcon } from "@/components/GoogleAuth";
import Hangman from "@/components/Hangman";
import { useToasts } from "@/components/ui";
import {
  TERMS_URL,
  authErrorMessage,
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/firebase";
import { displayName as clean } from "@/lib/game";
import type { TermsCheckResponse } from "@/lib/dto";

/**
 * Flujo de pasos:
 *
 * choose ──► login-email ──► login-pass        (iniciar sesión con correo)
 *        └─► register-email ──► register-terms ──► register-pass  (crear cuenta)
 *        └─► [Google]        (inmediato)
 *        └─► [Invitado]      (LAN / mismo teléfono)
 */
type Step =
  | "choose"
  | "login-email"
  | "login-pass"
  | "register-email"
  | "register-terms"
  | "register-pass";

export interface AuthGateProps {
  onGuest: () => void;
  guestLabel?: string;
  notice?: string;
}

const panel = {
  initial: { opacity: 0, y: 18, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export default function AuthGate({
  onGuest,
  guestLabel = "Jugar en red local o mismo teléfono",
  notice = "Sin cuenta solo puedes jugar en el mismo teléfono o en tu red Wi-Fi.",
}: AuthGateProps) {
  const { push, stack } = useToasts();
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);

  // Campos compartidos
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);

  const reset = (s: Step) => {
    setPassword("");
    setStep(s);
  };

  /* --------------------------------- Google -------------------------------- */
  const google = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      push(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /* --------------------------- Iniciar sesión ------------------------------ */
  const goLoginPass = () => {
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(mail)) {
      return push("Escribe un correo válido");
    }
    setStep("login-pass");
  };

  const doLogin = async () => {
    if (password.length < 6) return push("La contraseña debe tener al menos 6 caracteres");
    setBusy(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
    } catch (e) {
      push(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /* ----------------------------- Registrarse ------------------------------- */
  const goRegisterTerms = () => {
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(mail)) {
      return push("Escribe un correo válido");
    }
    setStep("register-terms");
  };

  const verifyTermsAndNext = async () => {
    const mail = email.trim().toLowerCase();
    if (!accepted) return push("Primero acepta los términos y condiciones");
    setBusy(true);
    try {
      const res = await fetch("/api/terms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mail }),
      });
      const data = (await res.json()) as TermsCheckResponse | { ok: false; error: string };
      if (!res.ok || !data.ok) {
        push("error" in data ? data.error : "No se pudo verificar");
        return;
      }
      if (data.status === "accepted") {
        setStep("register-pass");
      } else {
        // No está en el formulario: muestra un aviso pero deja continuar
        // (el formulario puede tardar unos segundos en sincronizarse)
        push("No encontramos tu correo aún. Si ya llenaste el formulario, espera un momento y vuelve a intentar.");
      }
    } catch {
      push("Sin conexión con el servidor");
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    if (clean(name).length < 2) return push("Escribe un nombre de al menos 2 letras");
    if (password.length < 6) return push("La contraseña debe tener al menos 6 caracteres");
    setBusy(true);
    try {
      await registerWithEmail(email.trim().toLowerCase(), password, clean(name));
    } catch (e) {
      push(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative mx-auto max-w-md px-4 pt-10 pb-16 min-h-dvh flex flex-col justify-center">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-1">
          <Hangman color="#FFD93D" failsUsed={7} failsTotal={10} className="w-20 h-24 animate-floaty" />
        </div>
        <h1 className="hand text-[clamp(2.8rem,12vw,4.4rem)] font-bold leading-[0.85] text-glow">
          El Ahorcado
        </h1>
      </div>

      <AnimatePresence mode="wait">

        {/* ========================= PANTALLA PRINCIPAL ========================= */}
        {step === "choose" && (
          <motion.div key="choose" {...panel} className="chalk-card p-6 grid gap-3">
            {/* Google */}
            <button
              type="button"
              onClick={() => void google()}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white text-slate-800 font-extrabold py-4 px-5 shadow-[0_14px_34px_-16px_rgba(255,255,255,0.4)] hover:bg-slate-100 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
              Continuar con Google
            </button>

            {/* Divisor */}
            <div className="flex items-center gap-3">
              <span className="flex-1 h-px bg-chalk/15" />
              <span className="text-xs font-bold text-chalk-dim">o con correo</span>
              <span className="flex-1 h-px bg-chalk/15" />
            </div>

            {/* Iniciar sesión */}
            <button
              type="button"
              onClick={() => { setEmail(""); reset("login-email"); }}
              className="btn-chalk btn-fill py-3.5 text-xl"
              style={{ ["--btn-color" as never]: "#4ECDC4" }}
            >
              <LogIn className="w-5 h-5" /> Iniciar sesión
            </button>

            {/* Registrarse */}
            <button
              type="button"
              onClick={() => { setEmail(""); setName(""); setAccepted(false); reset("register-email"); }}
              className="btn-chalk btn-fill py-3.5 text-xl"
              style={{ ["--btn-color" as never]: "#6BCB77" }}
            >
              <UserPlus className="w-5 h-5" /> Crear cuenta
            </button>

            {/* Invitado */}
            <button
              type="button"
              onClick={onGuest}
              className="btn-chalk py-3 text-lg mt-1"
              style={{ ["--btn-color" as never]: "#b9b4a6" }}
            >
              <Ghost className="w-4 h-4" /> {guestLabel}
            </button>

            <p className="text-[0.7rem] font-bold text-chalk-dim/75 text-center leading-relaxed">
              {notice}
            </p>
          </motion.div>
        )}

        {/* ========================= INICIAR SESIÓN – CORREO ========================= */}
        {step === "login-email" && (
          <motion.div key="login-email" {...panel} className="chalk-card p-6 grid gap-4">
            <h2 className="hand text-4xl font-bold leading-none flex items-center gap-2">
              <LogIn className="w-7 h-7 text-cyan-chalk" /> Iniciar sesión
            </h2>
            <p className="text-sm font-bold text-chalk-dim">
              Escribe el correo con el que creaste tu cuenta.
            </p>
            <input
              className="input-chalk"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tucorreo@gmail.com"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goLoginPass()}
            />
            <button
              type="button"
              className="btn-chalk btn-fill py-3.5 text-xl"
              style={{ ["--btn-color" as never]: "#4ECDC4" }}
              onClick={goLoginPass}
            >
              <Mail className="w-5 h-5" /> Continuar
            </button>
            <button
              type="button"
              className="text-sm font-bold text-chalk-dim hover:text-chalk flex items-center justify-center gap-1.5"
              onClick={() => setStep("choose")}
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            {/* Atajo a registrarse */}
            <p className="text-center text-sm font-bold text-chalk-dim mt-1">
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                className="text-mint underline decoration-dashed underline-offset-2 hover:text-chalk"
                onClick={() => { setAccepted(false); reset("register-email"); }}
              >
                Crear cuenta
              </button>
            </p>
          </motion.div>
        )}

        {/* ========================= INICIAR SESIÓN – CONTRASEÑA ========================= */}
        {step === "login-pass" && (
          <motion.div key="login-pass" {...panel} className="chalk-card p-6 grid gap-4">
            <h2 className="hand text-4xl font-bold leading-none flex items-center gap-2">
              <Lock className="w-7 h-7 text-cyan-chalk" /> Tu contraseña
            </h2>
            <p className="text-sm font-bold text-chalk-dim truncate">
              Cuenta: <b className="text-chalk">{email}</b>
            </p>
            <input
              className="input-chalk"
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void doLogin()}
            />
            <button
              type="button"
              className="btn-chalk btn-fill py-3.5 text-xl"
              style={{ ["--btn-color" as never]: "#4ECDC4" }}
              disabled={busy}
              onClick={() => void doLogin()}
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              Entrar
            </button>
            <button
              type="button"
              className="text-sm font-bold text-chalk-dim hover:text-chalk flex items-center justify-center gap-1.5"
              onClick={() => setStep("login-email")}
            >
              <ArrowLeft className="w-4 h-4" /> Cambiar correo
            </button>
          </motion.div>
        )}

        {/* ========================= REGISTRARSE – CORREO ========================= */}
        {step === "register-email" && (
          <motion.div key="register-email" {...panel} className="chalk-card p-6 grid gap-4">
            <h2 className="hand text-4xl font-bold leading-none flex items-center gap-2">
              <UserPlus className="w-7 h-7 text-mint" /> Crear cuenta
            </h2>
            <p className="text-sm font-bold text-chalk-dim leading-relaxed">
              Escribe el correo con el que llenaste el formulario de términos.
            </p>
            <input
              className="input-chalk"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tucorreo@gmail.com"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goRegisterTerms()}
            />
            <button
              type="button"
              className="btn-chalk btn-fill py-3.5 text-xl"
              style={{ ["--btn-color" as never]: "#6BCB77" }}
              onClick={goRegisterTerms}
            >
              <Mail className="w-5 h-5" /> Continuar
            </button>
            <button
              type="button"
              className="text-sm font-bold text-chalk-dim hover:text-chalk flex items-center justify-center gap-1.5"
              onClick={() => setStep("choose")}
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            {/* Atajo a iniciar sesión */}
            <p className="text-center text-sm font-bold text-chalk-dim mt-1">
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                className="text-cyan-chalk underline decoration-dashed underline-offset-2 hover:text-chalk"
                onClick={() => reset("login-email")}
              >
                Iniciar sesión
              </button>
            </p>
          </motion.div>
        )}

        {/* ========================= REGISTRARSE – TÉRMINOS ========================= */}
        {step === "register-terms" && (
          <motion.div key="register-terms" {...panel} className="chalk-card p-6 grid gap-4">
            <h2 className="hand text-4xl font-bold leading-none flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-sun" /> Términos
            </h2>
            <p className="text-sm font-bold text-chalk-dim leading-relaxed">
              Para crear tu cuenta necesitas haber llenado el formulario de términos con{" "}
              <b className="text-chalk">{email}</b>.
            </p>
            <a
              href={TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-chalk py-3 text-lg"
              style={{ ["--btn-color" as never]: "#FFD93D" }}
            >
              <ExternalLink className="w-4 h-4" /> Abrir formulario de términos
            </a>
            <label className="flex items-start gap-3 text-sm font-bold text-chalk-dim cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-mint shrink-0"
              />
              <span>
                Leí y acepto los{" "}
                <a
                  href={TERMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-chalk underline decoration-dashed underline-offset-2"
                >
                  términos y condiciones
                </a>{" "}
                y ya llené el formulario con este correo.
              </span>
            </label>
            <button
              type="button"
              className="btn-chalk btn-fill py-3.5 text-xl"
              style={{ ["--btn-color" as never]: "#6BCB77" }}
              disabled={busy || !accepted}
              onClick={() => void verifyTermsAndNext()}
            >
              {busy ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
              Verificar y continuar
            </button>
            <button
              type="button"
              className="text-sm font-bold text-chalk-dim hover:text-chalk flex items-center justify-center gap-1.5"
              onClick={() => setStep("register-email")}
            >
              <ArrowLeft className="w-4 h-4" /> Cambiar correo
            </button>
          </motion.div>
        )}

        {/* ========================= REGISTRARSE – DATOS ========================= */}
        {step === "register-pass" && (
          <motion.div key="register-pass" {...panel} className="chalk-card p-6 grid gap-4">
            <div className="flex items-center gap-2 text-mint font-extrabold text-sm">
              <ShieldCheck className="w-4 h-4" /> Correo verificado
            </div>
            <h2 className="hand text-4xl font-bold leading-none flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-sun" /> Casi listo
            </h2>
            <input
              className="input-chalk"
              placeholder="Tu nombre de jugador"
              value={name}
              maxLength={16}
              autoFocus
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input-chalk"
              type="password"
              autoComplete="new-password"
              placeholder="Contraseña (mínimo 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void doRegister()}
            />
            <button
              type="button"
              className="btn-chalk btn-fill py-3.5 text-xl"
              style={{ ["--btn-color" as never]: "#6BCB77" }}
              disabled={busy}
              onClick={() => void doRegister()}
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Crear cuenta y entrar
            </button>
            <button
              type="button"
              className="text-sm font-bold text-chalk-dim hover:text-chalk flex items-center justify-center gap-1.5"
              onClick={() => setStep("register-terms")}
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          </motion.div>
        )}

      </AnimatePresence>
      {stack}
    </main>
  );
}
