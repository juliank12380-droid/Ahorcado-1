"use client";

export interface SessionData {
  playerId: string;
  token: string;
  name: string;
}

const sessionKey = (code: string) => `ahorcado:session:${code.toUpperCase()}`;
const PROFILE_KEY = "ahorcado:profile";

export function saveSession(code: string, data: SessionData) {
  try {
    localStorage.setItem(sessionKey(code), JSON.stringify(data));
  } catch {
    /* sin almacenamiento */
  }
}

export function loadSession(code: string): SessionData | null {
  try {
    const raw = localStorage.getItem(sessionKey(code));
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

export function clearSession(code: string) {
  try {
    localStorage.removeItem(sessionKey(code));
  } catch {
    /* noop */
  }
}

export function saveProfile(profile: { name?: string; color?: string }) {
  try {
    const prev = loadProfile() ?? {};
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...prev, ...profile }));
  } catch {
    /* noop */
  }
}

export function loadProfile(): { name?: string; color?: string } | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as { name?: string; color?: string }) : null;
  } catch {
    return null;
  }
}

/* --------------------------- Identidad de invitado --------------------------- */

const GUEST_KEY = "ahorcado:guestId";
const GUEST_MODE_KEY = "ahorcado:guestMode";

/** Id estable del invitado para recuperar su lugar en las salas. */
export function getGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_KEY);
    if (existing) return existing;
    const id = `guest:${crypto.randomUUID()}`;
    localStorage.setItem(GUEST_KEY, id);
    return id;
  } catch {
    return `guest:${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }
}

export function setGuestMode(on: boolean) {
  try {
    if (on) localStorage.setItem(GUEST_MODE_KEY, "1");
    else localStorage.removeItem(GUEST_MODE_KEY);
  } catch {
    /* noop */
  }
}

export function isGuestMode(): boolean {
  try {
    return localStorage.getItem(GUEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}
