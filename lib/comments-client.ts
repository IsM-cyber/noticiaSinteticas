// Módulo SOLO para el navegador: nunca importar las claves secretas acá.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const COMMENTS_CONFIGURED = Boolean(URL && ANON_KEY);

export function supabaseBrowser(): SupabaseClient {
  return createClient(URL, ANON_KEY);
}

export type CommentRow = {
  id: number;
  story_key: string;
  user_id: string;
  author: string;
  body: string;
  status: "pending" | "approved" | "rejected" | "reported";
  created_at: string;
};

/** "jose*****@gmail.com" — mostrar el autor sin regalar el email completo */
export function maskAuthor(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}*****@${domain}`;
}