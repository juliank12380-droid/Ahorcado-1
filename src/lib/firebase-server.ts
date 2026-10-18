import { createVerify } from "crypto";

/**
 * Verificación de ID Tokens de Firebase Auth sin firebase-admin:
 * validamos el JWT firmado por Google con sus certificados públicos.
 * Solo hace falta conocer el Project ID (acepta FIREBASE_PROJECT_ID del
 * servidor o, en su defecto, NEXT_PUBLIC_FIREBASE_PROJECT_ID).
 */

export const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  // El Project ID no es secreto: sirve para validar el "aud" del token.
  "ahorcado-ac3a5";

export const firebaseServerEnabled = !!FIREBASE_PROJECT_ID;

export interface FirebaseIdentity {
  uid: string;
  name: string | null;
  picture: string | null;
}

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;
  const res = await fetch(CERTS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudieron descargar los certificados de Google (${res.status})`);
  let maxAge = 3600;
  const cc = res.headers.get("cache-control") ?? "";
  const m = /max-age=(\d+)/.exec(cc);
  if (m) maxAge = Math.min(parseInt(m[1], 10), 6 * 3600);
  const certs = (await res.json()) as Record<string, string>;
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

function decodeSegment(seg: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(seg, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Devuelve la identidad si el token es válido; null en caso contrario. */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity | null> {
  if (!FIREBASE_PROJECT_ID) return null;
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const header = decodeSegment(h);
    const payload = decodeSegment(p);
    if (!header || !payload) return null;
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (typeof payload.exp !== "number" || payload.exp < now - 60) return null;
    if (typeof payload.iat !== "number" || payload.iat > now + 300) return null;

    const certs = await getGoogleCerts();
    let cert = certs[header.kid as string];
    if (!cert) {
      // rotación de claves: fuerza refresco de certificados
      certCache = null;
      const fresh = await getGoogleCerts();
      cert = fresh[header.kid as string];
      if (!cert) return null;
    }

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${p}`);
    verifier.end();
    const ok = verifier.verify(cert, Buffer.from(s, "base64url"));
    if (!ok) return null;

    const uid = (payload.user_id as string | undefined) ?? (payload.sub as string | undefined);
    if (!uid) return null;
    return {
      uid,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    return null;
  }
}
