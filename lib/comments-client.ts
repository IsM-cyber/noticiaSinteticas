// lib/comments-client.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Sin credenciales fijas. Usamos las de entorno de Vercel.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export type CommentRow = {
  id: number;
  story_key: string;
  user_id: string;
  author: string;
  body: string;
  status: "pending" | "approved" | "rejected" | "reported";
  created_at: string;
};

export const COMMENTS_CONFIGURED = Boolean(URL && ANON_KEY);

export function supabaseBrowser(): SupabaseClient | null {
  if (!COMMENTS_CONFIGURED) {
    console.warn("Supabase no configurado (esto es normal si no se han cargado variables).");
    return null;
  }
  return createClient(URL, ANON_KEY);
}

export function maskAuthor(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}*****@${domain}`;
}
