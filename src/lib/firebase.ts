"use client";

import { useEffect, useState } from "react";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getAuth,
  getRedirectResult,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Config del proyecto. Las claves NEXT_PUBLIC_* de Firebase son públicas por
 * diseño (viajan al navegador), así que se dejan valores por defecto para que
 * el juego funcione aunque el archivo .env se regenere.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDREn8xBzuHtrWgzsk7EQLc5BF2kJUTDQQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "ahorcado-ac3a5.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "https://ahorcado-ac3a5-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ahorcado-ac3a5",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ahorcado-ac3a5.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "977171873220",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:977171873220:web:9543aeffb1f20fb4247891",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-1K62H88RFJ",
};

export const firebaseConfigured = !!(
  config.apiKey &&
  config.authDomain &&
  config.projectId &&
  config.appId
);

export const firebaseProjectId = config.projectId;
export const firebaseDatabaseURL = config.databaseURL;

export const TERMS_URL =
  process.env.NEXT_PUBLIC_TERMS_URL ??
  "https://sites.google.com/view/terminos-y-condiciones-de-ak/nuestros-productos/ahorcado-juego";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let fsdb: Firestore | null = null;
let rtdb: import("firebase/database").Database | null = null;
let redirectChecked = false;

function getApp(): FirebaseApp | null {
  if (!firebaseConfigured) return null;
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function getFbAuth(): Auth | null {
  const a = getApp();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  if (!redirectChecked) {
    redirectChecked = true;
    void getRedirectResult(auth).catch(() => null);
  }
  return auth;
}

export function getFbDb(): Firestore | null {
  const a = getApp();
  if (!a) return null;
  if (!fsdb) fsdb = getFirestore(a);
  return fsdb;
}

/* ----------------------- Realtime Database (partidas) ----------------------- */

/**
 * Se suscribe al estado en vivo de una sala publicado en Realtime Database.
 * Devuelve la función para cancelar la suscripción.
 */
export async function subscribeRoomRtdb(
  code: string,
  onChange: (snapshot: unknown) => void,
): Promise<() => void> {
  const a = getApp();
  if (!a) return () => {};
  try {
    const { getDatabase, ref, onValue } = await import("firebase/database");
    const db = rtdb ?? (rtdb = getDatabase(a));
    return onValue(ref(db, `rooms/${code.toUpperCase()}`), (snap) => onChange(snap.val()));
  } catch {
    return () => {};
  }
}

/** Analytics (opcional, solo navegador compatible). */
export async function initAnalytics(): Promise<void> {
  const a = getApp();
  if (!a || !config.measurementId) return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(a);
  } catch {
    /* entorno sin soporte */
  }
}

/* --------------------------------- Google -------------------------------- */

export async function signInWithGoogle(): Promise<User | null> {
  const a = getFbAuth();
  if (!a) throw new Error("Firebase no está configurado");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const cred = await signInWithPopup(a, provider);
    return cred.user;
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(a, provider);
      return null;
    }
    throw e;
  }
}

/* ---------------------------- Correo / contraseña ---------------------------- */

export async function emailHasAccount(email: string): Promise<boolean> {
  const a = getFbAuth();
  if (!a) return false;
  try {
    const methods = await fetchSignInMethodsForEmail(a, email);
    return methods.length > 0;
  } catch {
    return false;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const a = getFbAuth();
  if (!a) throw new Error("Firebase no está configurado");
  const cred = await signInWithEmailAndPassword(a, email, password);
  return cred.user;
}

export async function registerWithEmail(email: string, password: string, name: string): Promise<User> {
  const a = getFbAuth();
  if (!a) throw new Error("Firebase no está configurado");
  const cred = await createUserWithEmailAndPassword(a, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred.user;
}

/** Cambia la contraseña (pide la actual si la sesión es antigua). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const a = getFbAuth();
  const u = a?.currentUser;
  if (!u || !u.email) throw new Error("No hay sesión con correo");
  try {
    await updatePassword(u, newPassword);
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "auth/requires-recent-login" && currentPassword) {
      const cred = EmailAuthProvider.credential(u.email, currentPassword);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, newPassword);
      return;
    }
    throw e;
  }
}

/** Añade contraseña a una cuenta creada con Google (para entrar también por correo). */
export async function attachPassword(password: string): Promise<void> {
  const a = getFbAuth();
  const u = a?.currentUser;
  if (!u || !u.email) throw new Error("No hay sesión activa");
  const cred = EmailAuthProvider.credential(u.email, password);
  await linkWithCredential(u, cred);
}

export async function updateDisplayName(name: string): Promise<void> {
  const a = getFbAuth();
  const u = a?.currentUser;
  if (!u) return;
  await updateProfile(u, { displayName: name });
}

export async function signOutFirebase(): Promise<void> {
  const a = getFbAuth();
  if (a) await signOut(a);
}

export function hasPasswordProvider(user: User | null): boolean {
  return !!user?.providerData.some((p) => p.providerId === "password");
}

export function useFirebaseUser(): { user: User | null; loading: boolean; enabled: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    const a = getFbAuth();
    if (!a) {
      // Sin configuración, `loading` ya arranca en false (ver useState inicial);
      // LINT-FIX: este setState síncrono era redundante y rompía la regla
      // react-hooks/set-state-in-effect.
      return;
    }
    void initAnalytics();
    return onAuthStateChanged(a, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading, enabled: firebaseConfigured };
}

export async function currentIdToken(forceRefresh = false): Promise<string | null> {
  const u = getFbAuth()?.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

/** Mensajes de error de Firebase en español. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-email": "Ese correo no es válido.",
    "auth/user-disabled": "Esa cuenta está deshabilitada.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ese correo ya tiene cuenta. Inicia sesión.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento.",
    "auth/network-request-failed": "Sin conexión con Firebase.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google.",
    "auth/credential-already-in-use": "Esa contraseña ya está vinculada a otra cuenta.",
    "auth/requires-recent-login": "Por seguridad, vuelve a iniciar sesión.",
    "auth/operation-not-allowed": "Habilita este método de acceso en Firebase Authentication.",
  };
  return map[code] ?? "No se pudo completar la operación. Inténtalo de nuevo.";
}
