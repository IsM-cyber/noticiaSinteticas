// Módulo SOLO para el navegador: nunca importar las claves secretas acá.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const COMMENTS_CONFIGURED = Boolean(URL && ANON_KEY);

export type CommentRow = {
  id: number;
  story_key: string;
  user_id: string;
  author: string;
  body: string;
  status: "pending" | "approved" | "rejected" | "reported";
  created_at: string;
};

/** Cliente blindado: devuelve null si faltan las credenciales para evitar crasheos */
export function supabaseBrowser(): SupabaseClient | null {
  if (!COMMENTS_CONFIGURED) {
    console.warn("Supabase no configurado: URL o ANON_KEY faltantes.");
    return null;
  }
  return createClient(URL, ANON_KEY);
}

/** "jose*****@gmail.com" — mostrar el autor sin regalar el email completo */
export function maskAuthor(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}*****@${domain}`;
}
