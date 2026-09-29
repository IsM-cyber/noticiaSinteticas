// Módulo SOLO del servidor (route handlers). Nunca importar desde un componente.
// El navegador NO habla directo con Supabase: la red local no resuelve el dominio,
// así que todo pasa por /api/* que usa la service role key.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// El servidor NO necesita el prefijo NEXT_PUBLIC_: el cliente ya no habla con
// Supabase, todo pasa por acá. SUPABASE_URL (sin prefijo) permite configurarla
// en Vercel sin el aviso de "public framework prefix".
//
// La URL va embebida porque NO es un secreto: es un dominio publico por diseño
// (se deduce de la publishable key, que es publica). Verificada contra DNS
// publico: iojariyxydsfnorzjtwo.supabase.co resuelve a IPs de Cloudflare.
// La que SI es secreta, SUPABASE_SERVICE_ROLE_KEY, nunca va en el codigo:
// vive solo en las variables de entorno de Vercel.
// La URL del proyecto NO es un secreto (es un dominio publico), por eso puede
// estar embebida en el codigo. La dejo como ultima instancia, pero tambien
// respeto SUPABASE_URL cuando es una URL valida. Ignoro explicitamente la URL
// inventada "noticiasinteticas.supabase.co" (NXDOMAIN) que rompio el deploy:
// una variable de entorno vieja no debe poder romper el sitio. Verificado con
// DNS publico: iojariyxydsfnorzjtwo.supabase.co resuelve a IPs de Cloudflare.
const FAKE_URL = "https://noticiasinteticas.supabase.co";
const REAL_URL = "https://iojariyxydsfnorzjtwo.supabase.co";
const urlFromEnv = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const URL = urlFromEnv && urlFromEnv !== FAKE_URL ? urlFromEnv : REAL_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Solo hacen falta URL + service role. El cliente ya no usa la anon key. */
export const SUPABASE_CONFIGURED = Boolean(URL && SERVICE_KEY);

/** Cliente con permisos de moderación. null si falta configuración. */
export function supabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  return createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/** Email del dueño (puede moderar). */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

/** "ab*****@gmail.com" — ofusca, nunca regala el email completo. */
export function maskEmail(email: string): string {
  const [name, domain] = (email ?? "").split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}*****@${domain}`;
}

/**
 * Nombre público de un comentario o mensaje:
 * - el editor se muestra como "Editor" (su email jamás sale del servidor)
 * - los demás: "ab*****@gmail.com"
 */
export function publicAuthor(author: string): string {
  if (!ADMIN_EMAIL) return maskEmail(author);
  if (author.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return "Editor";
  return maskEmail(author);
}

/**
 * Nombre visible que se guarda: el que eligió el usuario, o el email
 * enmascarado si no eligió ninguno. Si pegó un email como nombre, se enmascara.
 */
export function safeAuthor(rawEmail: string, chosen: string | undefined): string {
  const isEditor = !!ADMIN_EMAIL && rawEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if (isEditor) return "Editor";

  let visible = typeof chosen === "string" ? chosen.trim().slice(0, 30) : "";
  visible = visible.replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (visible.includes("@")) visible = maskEmail(visible);

  return visible || maskEmail(rawEmail) || "anónimo";
}
