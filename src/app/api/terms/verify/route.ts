import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { verifiedEmails } from "@/db/schema";
import { isEmailVerifiedInRtdb } from "@/lib/rtdb";
import type { TermsCheckResponse, TermsStatus } from "@/lib/dto";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Consulta la hoja/endpoint del formulario de Google.
 * Acepta tanto un Apps Script que devuelva JSON como un CSV publicado
 * del Sheet de respuestas: en ambos casos basta con que el correo aparezca.
 */
async function emailInFormResponses(email: string): Promise<boolean | null> {
  const endpoint = process.env.TERMS_FORM_ENDPOINT?.trim();
  if (!endpoint) return null;

  try {
    const url = new URL(endpoint);
    url.searchParams.set("email", email);
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json, text/csv;q=0.9, text/plain;q=0.8" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const text = (await res.text()).trim();
    // Respuesta JSON de Apps Script: {"accepted":true} | {"found":true} | true
    if (text.startsWith("{") || text.startsWith("[") || text === "true" || text === "false") {
      try {
        const data = JSON.parse(text) as unknown;
        if (typeof data === "boolean") return data;
        if (Array.isArray(data)) {
          return data.some((row) => JSON.stringify(row).toLowerCase().includes(email));
        }
        if (data && typeof data === "object") {
          const o = data as Record<string, unknown>;
          const flag = o.accepted ?? o.found ?? o.ok ?? o.exists;
          if (typeof flag === "boolean") return flag;
          return JSON.stringify(o).toLowerCase().includes(email);
        }
      } catch {
        /* cae al modo texto */
      }
    }
    // CSV / texto plano: basta con que el correo esté listado
    return text.toLowerCase().includes(email);
  } catch {
    return null;
  }
}

/**
 * Verifica si un correo aceptó los términos y condiciones llenando el
 * formulario de Google del sitio. Resultado:
 *  - accepted      => puede crear cuenta / iniciar sesión con ese correo
 *  - not-found     => no aparece en el formulario (se le ofrece modo invitado)
 *  - unconfigured  => no hay endpoint del formulario configurado en el servidor
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return err("Escribe un correo electrónico válido");

  // 1) Caché local (ya verificado antes)
  const cached = await db
    .select()
    .from(verifiedEmails)
    .where(eq(verifiedEmails.email, email))
    .limit(1);

  if (cached[0]) {
    await db
      .update(verifiedEmails)
      .set({ lastCheckedAt: new Date() })
      .where(eq(verifiedEmails.email, email));
    const res: TermsCheckResponse = {
      ok: true,
      status: "accepted",
      email,
      message: "Términos aceptados. ¡Puedes continuar!",
    };
    return NextResponse.json(res);
  }

  // 2) Realtime Database: lo que Apps Script sincroniza desde el formulario
  const inRtdb = await isEmailVerifiedInRtdb(email);
  if (inRtdb === true) {
    await db.insert(verifiedEmails).values({ email, source: "rtdb" }).onConflictDoNothing();
    const res: TermsCheckResponse = {
      ok: true,
      status: "accepted",
      email,
      message: "Encontramos tu respuesta del formulario. ¡Bienvenido!",
    };
    return NextResponse.json(res);
  }

  // 3) Respaldo: consulta directa al endpoint del formulario (Apps Script/CSV)
  const inForm = await emailInFormResponses(email);

  if (inForm === true) {
    await db
      .insert(verifiedEmails)
      .values({ email, source: "form" })
      .onConflictDoNothing();
    const res: TermsCheckResponse = {
      ok: true,
      status: "accepted",
      email,
      message: "Encontramos tu respuesta en el formulario. ¡Bienvenido!",
    };
    return NextResponse.json(res);
  }

  const status: TermsStatus = inForm === null ? "unconfigured" : "not-found";
  const res: TermsCheckResponse = {
    ok: true,
    status,
    email,
    message:
      status === "not-found"
        ? "Ese correo no aparece en el formulario de términos y condiciones."
        : "La verificación automática no está disponible ahora mismo.",
  };
  return NextResponse.json(res);
}
