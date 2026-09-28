// lib/comments-client.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Credenciales fijas para bypass de Vercel
const URL = "https://noticiasinteticas.supabase.co";
const ANON_KEY = "sb_publishable_VWr41XwLgexSou8zsbKVBg_s3ImXse4";

export type CommentRow = {
  id: number;
  story_key: string;
  user_id: string;
  author: string;
  body: string;
  status: "pending" | "approved" | "rejected" | "reported";
  created_at: string;
};

export const COMMENTS_CONFIGURED = true; // Forzamos a true

export function supabaseBrowser(): SupabaseClient {
  return createClient(URL, ANON_KEY);
}

export function maskAuthor(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}*****@${domain}`;
}
