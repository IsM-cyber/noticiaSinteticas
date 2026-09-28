// Módulo SOLO para el navegador
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type CommentRow = {
  id: number;
  story_key: string;
  user_id: string;
  author: string;
  body: string;
  status: "pending" | "approved" | "rejected" | "reported";
  created_at: string;
};

// DEBUG: Imprimir parte del valor para saber si Vercel realmente está inyectando algo
console.log("DEBUG SUPABASE:", { 
  URL_snippet: URL ? URL.substring(0, 10) + "..." : "VACÍA", 
  ANON_KEY_snippet: ANON_KEY ? ANON_KEY.substring(0, 5) + "..." : "VACÍA" 
});

export const COMMENTS_CONFIGURED = Boolean(URL && ANON_KEY);

export function supabaseBrowser(): SupabaseClient | null {
  if (!COMMENTS_CONFIGURED) {
    console.error("Supabase NO está configurado. Revisa las variables en Vercel.");
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
