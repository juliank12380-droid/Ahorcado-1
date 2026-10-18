import { randomUUID } from "crypto";
import {
  firebaseServerEnabled,
  verifyFirebaseIdToken,
  type FirebaseIdentity,
} from "@/lib/firebase-server";

export interface ResolvedIdentity {
  uid: string;
  photo: string | null;
  kind: "account" | "guest";
  google: FirebaseIdentity | null;
}

export type IdentityResult =
  | { ok: true; identity: ResolvedIdentity }
  | { ok: false; status: number; error: string };

const GUEST_RE = /^guest:[a-zA-Z0-9-]{6,64}$/;

/**
 * Identidad del jugador:
 * - `idToken` de Firebase (Google o correo/contraseña) => cuenta verificada.
 * - `guestId` (guest:<uuid> generado en el navegador) => invitado, puede jugar
 *   igual pero su progreso no se guarda en la nube.
 */
export async function resolveIdentity(
  idToken: unknown,
  guestId?: unknown,
): Promise<IdentityResult> {
  const token = typeof idToken === "string" && idToken.length > 20 ? idToken : null;

  if (token) {
    if (!firebaseServerEnabled) {
      return {
        ok: false,
        status: 503,
        error: "El servidor no tiene FIREBASE_PROJECT_ID configurado.",
      };
    }
    const account = await verifyFirebaseIdToken(token);
    if (!account) {
      return { ok: false, status: 401, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    return {
      ok: true,
      identity: { uid: account.uid, photo: account.picture, kind: "account", google: account },
    };
  }

  const guest = typeof guestId === "string" && GUEST_RE.test(guestId) ? guestId : null;
  return {
    ok: true,
    identity: { uid: guest ?? `guest:${randomUUID()}`, photo: null, kind: "guest", google: null },
  };
}
