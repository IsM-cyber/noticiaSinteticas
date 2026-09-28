// Módulo SOLO para el navegador
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Credenciales públicas con respaldo directo para evitar fallos en Vercel
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://noticiasinteticas.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_VWr41XwLgexSou8zsbKVBg_s3ImXse4";

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

console.log("DEBUG SUPABASE (Con respaldo):", { URL, hasKey: !!ANON_KEY });

export function supabaseBrowser(): SupabaseClient | null {
  if (!COMMENTS_CONFIGURED) {
    console.error("Supabase NO está configurado.");
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
