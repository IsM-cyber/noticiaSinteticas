// Módulo SOLO del servidor (usa SUPABASE_SERVICE_ROLE_KEY).
// Nombre público de un usuario: nunca sale el email completo.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const SUPABASE_CONFIGURED = Boolean(URL && ANON_KEY && SERVICE_KEY);

/** Cliente del lado del servidor con permisos de moderación. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/** Email del dueño (puede moderar). Se configura en Vercel. */
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
  if (author.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return "Editor";
  return maskEmail(author);
}

/**
 * Nombre visible que se guarda: el que eligió el usuario, o el email
 * enmascarado si no eligió ninguno. Si pegó un email como nombre, se enmascara.
 */
export function safeAuthor(rawEmail: string, chosen: string | undefined): string {
  const isEditor = rawEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if (isEditor) return "Editor";

  let visible = typeof chosen === "string" ? chosen.trim().slice(0, 30) : "";
  visible = visible.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (visible.includes("@")) visible = maskEmail(visible);

  return visible || maskEmail(rawEmail) || "anónimo";
}
