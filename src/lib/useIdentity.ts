"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { currentIdToken, useFirebaseUser } from "@/lib/firebase";
import { getGuestId, isGuestMode, loadProfile, setGuestMode } from "@/lib/session";
import { loadProfileDoc, saveProfileDoc, type PlayerProfileDoc } from "@/lib/profile";
import { PLAYER_COLORS } from "@/lib/game";

export interface IdentityBody {
  idToken: string | null;
  guestId: string | null;
}

export interface IdentityState {
  user: User | null;
  guest: boolean;
  /** true cuando hay cuenta o el jugador eligió modo invitado */
  signedIn: boolean;
  loading: boolean;
  profile: PlayerProfileDoc | null;
  displayName: string;
  color: string;
  setDisplayName: (name: string) => void;
  setColor: (color: string) => void;
  continueAsGuest: () => void;
  leaveGuest: () => void;
  authBody: () => Promise<IdentityBody>;
  refreshProfile: () => void;
}

/**
 * Identidad unificada del jugador: cuenta de Firebase (Google o correo) o
 * modo invitado. Mantiene el nombre y el color predeterminados sincronizados
 * con Firestore cuando hay cuenta, y con el almacenamiento local si no.
 */
export function useIdentity(): IdentityState {
  const { user, loading } = useFirebaseUser();
  const [guest, setGuest] = useState(false);
  const [profile, setProfile] = useState<PlayerProfileDoc | null>(null);
  const [displayName, setDisplayNameState] = useState("");
  const [color, setColorState] = useState(PLAYER_COLORS[1].value);
  const [profileTick, setProfileTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const local = loadProfile();
    if (local?.name) setDisplayNameState(local.name);
    if (local?.color) setColorState(local.color);
    setGuest(isGuestMode());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    void loadProfileDoc(user.uid).then((doc) => {
      if (cancelled) return;
      setProfile(doc);
      const name = doc?.name ?? user.displayName?.split(" ")[0] ?? "";
      if (name) setDisplayNameState(name);
      if (doc?.color) setColorState(doc.color);
    });
    return () => {
      cancelled = true;
    };
  }, [user, profileTick]);

  const setDisplayName = useCallback(
    (name: string) => {
      setDisplayNameState(name);
      if (user) void saveProfileDoc(user.uid, { name });
    },
    [user],
  );

  const setColor = useCallback(
    (c: string) => {
      setColorState(c);
      if (user) void saveProfileDoc(user.uid, { color: c });
    },
    [user],
  );

  const continueAsGuest = useCallback(() => {
    getGuestId();
    setGuestMode(true);
    setGuest(true);
  }, []);

  const leaveGuest = useCallback(() => {
    setGuestMode(false);
    setGuest(false);
  }, []);

  const authBody = useCallback(async (): Promise<IdentityBody> => {
    if (user) {
      const token = await currentIdToken();
      if (token) return { idToken: token, guestId: null };
    }
    return { idToken: null, guestId: getGuestId() };
  }, [user]);

  return {
    user,
    guest: guest && !user,
    signedIn: !!user || guest,
    loading: loading || !hydrated,
    profile,
    displayName,
    color,
    setDisplayName,
    setColor,
    continueAsGuest,
    leaveGuest,
    authBody,
    refreshProfile: () => setProfileTick((t) => t + 1),
  };
}

/**
 * Modos a los que puede entrar el jugador. La cuenta en línea es la única
 * condición para crear o unirse a salas de nube; el invitado solo puede
 * jugar en el mismo teléfono o en la red local (LAN).
 */
export type AllowedMode = "local" | "lan" | "online";

export function allowedModes(identity: Pick<IdentityState, "user">): AllowedMode[] {
  // En el teléfono y en LAN cualquiera juega; en línea siempre con cuenta.
  return identity.user ? ["local", "lan", "online"] : ["local", "lan"];
}
